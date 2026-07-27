// How to use the webhook URL?
//
// WhatsApp webhook url:
// https://bridge.h9y.localhost/whatsapp/6a65228445db440c8916db0c/webhook
//
// brew install ngrok
// ngrok config add-authtoken NGROK_TOKEN
// ngrok http --url=bright-right-elk.ngrok-free.app 6370
// Your dev domain: https://bright-right-elk.ngrok-free.app
// https://bright-right-elk.ngrok-free.app/whatsapp/6a65228445db440c8916db0c/webhook 
import crypto from 'crypto'
import path from 'path'

import axios from 'axios'
import FormData from 'form-data'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
import webServer from './web-server.js'
import {
  DurableOutbox,
  XmppAttachmentCollector,
  createInboundXmppQueue,
  downloadAttachments,
  enqueueEnvelopeForXmpp,
  isXmppFileUrl,
  makeInboundEnvelope,
  parseXmppPayload,
} from './omnichannel.js'

const verbose = Verbose('sd:bridge/whatsapp'); verbose('')

const MEDIA_TYPES = new Set(['audio', 'document', 'image', 'sticker', 'video'])
const MIME_EXTENSIONS = {
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'video/3gpp': '3gp',
  'video/mp4': 'mp4',
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''))
  const rightBuffer = Buffer.from(String(right || ''))
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function messageText(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body || ''
    case 'button':
      return message.button?.text || message.button?.payload || ''
    case 'interactive': {
      const reply = message.interactive?.button_reply || message.interactive?.list_reply
      return reply?.title || reply?.id || ''
    }
    case 'location': {
      const location = message.location || {}
      const label = location.name || location.address || 'Shared location'
      return `${label}: https://maps.google.com/?q=${location.latitude},${location.longitude}`
    }
    case 'contacts':
      return `Shared contacts: ${JSON.stringify(message.contacts || [])}`
    case 'reaction':
      return `Reaction ${message.reaction?.emoji || ''} to ${message.reaction?.message_id || 'a message'}`
    case 'order':
      return `Order: ${JSON.stringify(message.order || {})}`
    case 'system':
      return message.system?.body || JSON.stringify(message.system || {})
    default:
      if (MEDIA_TYPES.has(message.type)) {
        return message[message.type]?.caption || `[${message.type}]`
      }
      return JSON.stringify(message)
  }
}

/**
 * Bridge between XMPP and the official Meta WhatsApp Cloud API.
 *
 * Inbound messages are delivered by Meta to `webhookUrl`; outbound XMPP
 * messages are sent through the Graph API. An XMPP message can be plain text,
 * or JSON in the form `{ "to": "15551234567", "text": "Hello" }`. A complete
 * Cloud API message object can be supplied as `{ "to": "...", "type": ... }`.
 */
export default class WhatsApp extends Connector {
  constructor(args) {
    super(args)
    verbose('WhatsApp bridge constructed')

    this.xmppAgent = new XmppAgent({
      agent: {
        _id: `bridge:${this.bridge._id.toString()}`,
        archetype: `bridge:${this.bridge.connector}`,
        options: {
          name: this.bridge.options.name,
          joinRooms: this.bridge.options.joinRooms,
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.enablePersonal,
      handleRooms: this.bridge.options.enableRoom,
    })

    this.path = null
    this.lastSender = null
    this.processedMessageIds = new Set()
    this.attachmentCollector = new XmppAttachmentCollector()
    this.outbox = null
    this.inboundQueue = null
  }

  get options() {
    return this.bridge.options.whatsapp || {}
  }

  get graphBaseUrl() {
    const version = this.options.apiVersion || 'v23.0'
    return `https://graph.facebook.com/${version}`
  }

  get webhookUrl() {
    return `${conf.webServer.origin}${this.path}`
  }

  authHeaders() {
    return { Authorization: `Bearer ${this.options.accessToken}` }
  }

  validateOptions() {
    const missing = ['accessToken', 'phoneNumberId', 'verifyToken']
      .filter(key => !this.options[key])
    if (missing.length) {
      throw new Error(`Missing WhatsApp option(s): ${missing.join(', ')}`)
    }
  }

  async start() {
    await super.start()
    verbose('WhatsApp bridge starting')

    try {
      this.validateOptions()
      await webServer.start()

      const endpoint = String(this.options.endpoint || 'webhook').replace(/^\/+|\/+$/g, '')
      this.path = path.posix.join('/whatsapp', this.bridge._id.toString(), endpoint)

      webServer.addRoute({
        path: this.path,
        method: 'get',
        handler: (req, res) => this.verifyWebhook(req, res),
      })
      webServer.addRoute({
        path: this.path,
        method: 'post',
        handler: (req, res) => this.receiveWebhook(req, res),
      })

      await this.xmppAgent.start()

      this.outbox = new DurableOutbox({
        bridgeId: this.bridge._id.toString(),
        config: conf.whatsapp,
        deliver: payload => this.sendFromXmpp(payload.prompt, payload.attachmentUrls),
        onState: (state, job) => this.logOutboxState(state, job),
      })
      this.outbox.start()
      this.inboundQueue = createInboundXmppQueue({
        bridge: this.bridge,
        xmppAgent: this.xmppAgent,
        options: this.options,
        config: conf.whatsapp,
        onState: (state, job) => this.logInboundQueueState(state, job),
      })
      this.inboundQueue.start()

      this.xmppAgent.chat = async ({ prompt, from } = {}) => {
        if (isXmppFileUrl(prompt)) {
          this.attachmentCollector.add(from, prompt)
          return ''
        }
        const attachmentUrls = this.attachmentCollector.take(from)
        const job = await this.outbox.enqueue({ prompt, attachmentUrls })
        await this.slog('info', 'Queued XMPP message for WhatsApp delivery', {
          outboxJobId: job.id,
          attachmentCount: attachmentUrls.length,
        })
        return ''
      }

      log('WhatsApp bridge webhook:', this.webhookUrl)
      await this.slog('info', 'WhatsApp bridge started', {
        webhookUrl: this.webhookUrl,
        phoneNumberId: this.options.phoneNumberId,
      })
    } catch (err) {
      error('Error starting WhatsApp bridge:', err)
      await this.slog('error', 'Error starting WhatsApp bridge', {
        error: err.toString(),
      })
      await this.stop()
    }
  }

  verifyWebhook(req, res) {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && safeEqual(token, this.options.verifyToken)) {
      verbose('WhatsApp webhook verified')
      return res.status(200).send(challenge)
    }
    warn('Rejected WhatsApp webhook verification request')
    return res.sendStatus(403)
  }

  hasValidSignature(req) {
    if (!this.options.appSecret) return true

    const supplied = req.get('x-hub-signature-256')
    if (!supplied || !req.rawBody) return false

    const expected = `sha256=${crypto
      .createHmac('sha256', this.options.appSecret)
      .update(req.rawBody)
      .digest('hex')}`
    return safeEqual(supplied, expected)
  }

  async receiveWebhook(req, res) {
    if (!this.hasValidSignature(req)) {
      warn('Rejected WhatsApp webhook with an invalid signature')
      return res.sendStatus(401)
    }

    // Meta retries deliveries unless it receives a success response promptly.
    res.sendStatus(200)

    try {
      await this.processWebhookPayload(req.body)
    } catch (err) {
      error('Failed to process WhatsApp webhook:', err.response?.data || err)
      await this.slog('error', 'Failed to process WhatsApp webhook', {
        error: err.response?.data || err.toString(),
      })
    }
  }

  async processWebhookPayload(payload) {
    if (payload?.object !== 'whatsapp_business_account') {
      warn('Ignoring a non-WhatsApp webhook payload')
      return
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue
        const value = change.value || {}
        for (const status of value.statuses || []) {
          await this.slog(
            status.status === 'failed' ? 'error' : 'info',
            `WhatsApp delivery status: ${status.status}`,
            {
              messageId: status.id,
              recipient: status.recipient_id,
              timestamp: status.timestamp,
              errors: status.errors,
            }
          )
        }
        const contactNames = new Map(
          (value.contacts || []).map(contact => [
            contact.wa_id,
            contact.profile?.name,
          ])
        )

        for (const message of value.messages || []) {
          if (!message.id || this.processedMessageIds.has(message.id)) continue
          this.lastSender = message.from

          const senderName = contactNames.get(message.from)
          const attachment = MEDIA_TYPES.has(message.type)
            ? await this.downloadMedia(message)
            : null
          let prompt = `💬 WhatsApp from ${senderName || message.from}`
          if (senderName) prompt += ` (${message.from})`
          prompt += `\n${messageText(message)}`
          const envelope = makeInboundEnvelope({
            channel: 'whatsapp',
            externalMessageId: message.id,
            conversationId: message.from,
            from: message.from,
            fromName: senderName || null,
            to: value.metadata?.display_phone_number || value.metadata?.phone_number_id,
            timestamp: message.timestamp
              ? new Date(Number(message.timestamp) * 1000).toISOString()
              : undefined,
            text: messageText(message),
            extra: {
              provider: 'whatsapp-cloud-api',
              phoneNumberId: value.metadata?.phone_number_id || null,
            },
          })
          await enqueueEnvelopeForXmpp(this.inboundQueue, {
            envelope,
            humanText: prompt,
            attachments: attachment ? [attachment] : [],
          })
          this.rememberMessageId(message.id)
          await this.markAsRead(message.id)
          await this.slog('info', 'Received WhatsApp message', {
            from: message.from,
            messageId: message.id,
            type: message.type,
          })
        }
      }
    }
  }

  rememberMessageId(messageId) {
    this.processedMessageIds.add(messageId)
    // Bound memory usage while retaining enough IDs to absorb webhook retries.
    if (this.processedMessageIds.size > 1000) {
      const oldest = this.processedMessageIds.values().next().value
      this.processedMessageIds.delete(oldest)
    }
  }

  async downloadMedia(message) {
    const media = message[message.type]
    if (!media?.id) return null

    try {
      const metadata = await axios.get(`${this.graphBaseUrl}/${media.id}`, {
        headers: this.authHeaders(),
      })
      const download = await axios.get(metadata.data.url, {
        headers: this.authHeaders(),
        responseType: 'arraybuffer',
      })
      const contentType = metadata.data.mime_type ||
        download.headers['content-type'] ||
        'application/octet-stream'
      const extension = MIME_EXTENSIONS[contentType] || 'bin'
      const filename = media.filename || `${message.type}-${media.id}.${extension}`
      return {
        buffer: Buffer.from(download.data),
        filename,
        contentType,
      }
    } catch (err) {
      warn('Could not copy WhatsApp media to XMPP:', err.response?.data || err)
      throw err
    }
  }

  async markAsRead(messageId) {
    if (this.options.markAsRead === false) return
    try {
      await axios.post(
        `${this.graphBaseUrl}/${this.options.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        { headers: this.authHeaders() }
      )
    } catch (err) {
      warn('Could not mark WhatsApp message as read:', err.response?.data || err)
    }
  }

  async sendFromXmpp(prompt, attachmentUrls = []) {
    const parsed = parseXmppPayload(prompt)

    let payload
    if (parsed) {
      const allowedFields = [
        'audio', 'biz_opaque_callback_data', 'contacts', 'context', 'document',
        'image', 'interactive', 'location', 'reaction', 'recipient_type',
        'sticker', 'template', 'type', 'video',
      ]
      const cloudMessage = Object.fromEntries(
        allowedFields
          .filter(key => parsed[key] !== undefined)
          .map(key => [key, parsed[key]])
      )
      payload = {
        ...cloudMessage,
        messaging_product: 'whatsapp',
        recipient_type: cloudMessage.recipient_type || 'individual',
        to: parsed.to || this.options.defaultRecipient || this.lastSender,
      }
      if (!payload.type) {
        payload.type = 'text'
        payload.text = typeof parsed.text === 'object'
          ? parsed.text
          : { body: parsed.text == null ? '' : String(parsed.text) }
      } else if (payload.type === 'text' && typeof payload.text === 'string') {
        payload.text = { body: payload.text }
      }
    }

    if (!payload.to) {
      throw new Error('WhatsApp recipient is required; set defaultRecipient or provide "to"')
    }
    if (payload.type === 'text' && !payload.text?.body) {
      throw new Error('WhatsApp text message body cannot be empty')
    }

    const embeddedUrls = Array.isArray(parsed.attachments)
      ? parsed.attachments
        .map(item => typeof item === 'string' ? item : item?.url)
        .filter(Boolean)
      : []
    const attachments = await downloadAttachments([
      ...attachmentUrls,
      ...embeddedUrls,
    ])
    for (const attachment of attachments) {
      const mediaId = await this.uploadMedia(attachment)
      await this.sendCloudPayload({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: payload.to,
        type: this.cloudMediaType(attachment.contentType),
        [this.cloudMediaType(attachment.contentType)]: {
          id: mediaId,
          ...(this.cloudMediaType(attachment.contentType) === 'document'
            ? { filename: attachment.filename }
            : {}),
        },
      })
    }
    return await this.sendCloudPayload(payload)
  }

  async sendCloudPayload(payload) {
    const response = await axios.post(
      `${this.graphBaseUrl}/${this.options.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          ...this.authHeaders(),
          'Content-Type': 'application/json',
        },
      }
    )

    await this.slog('info', 'Sent WhatsApp message', {
      to: payload.to,
      messageId: response.data?.messages?.[0]?.id,
      type: payload.type,
    })
    return response.data
  }

  cloudMediaType(contentType) {
    if (contentType.startsWith('image/')) return 'image'
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('audio/')) return 'audio'
    return 'document'
  }

  async uploadMedia(attachment) {
    const form = new FormData()
    form.append('messaging_product', 'whatsapp')
    form.append('file', attachment.buffer, {
      filename: attachment.filename,
      contentType: attachment.contentType,
      knownLength: attachment.buffer.length,
    })
    const response = await axios.post(
      `${this.graphBaseUrl}/${this.options.phoneNumberId}/media`,
      form,
      {
        headers: {
          ...this.authHeaders(),
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    )
    if (!response.data?.id) throw new Error('WhatsApp media upload returned no media ID')
    return response.data.id
  }

  async logOutboxState(state, job) {
    const level = state === 'failed' ? 'error' : state === 'retrying' ? 'warn' : 'info'
    await this.slog(level, `WhatsApp outbox job ${state}`, {
      outboxJobId: job.id,
      attempts: job.attempts,
      error: job.lastError,
    })
  }

  async logInboundQueueState(state, job) {
    const level = state === 'failed' ? 'error' : state === 'retrying' ? 'warn' : 'info'
    await this.slog(level, `WhatsApp inbound XMPP job ${state}`, {
      inboundJobId: job.id,
      attempts: job.attempts,
      error: job.lastError,
    })
  }

  async stop() {
    await super.stop()
    this.outbox?.stop()
    this.inboundQueue?.stop()
    if (this.path && webServer.app) {
      webServer.removeRoute({ path: this.path, method: 'get' })
      webServer.removeRoute({ path: this.path, method: 'post' })
    }
    await this.xmppAgent.stop().catch(() => {})
    verbose('WhatsApp bridge stopped')
    await this.slog('debug', 'Bridge stopped')
  }
}
