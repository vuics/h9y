import fs from 'fs'
import path from 'path'

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  generateMessageIDV2,
  getContentType,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/baileys'); verbose('')

const MEDIA_TYPES = new Set([
  'audioMessage',
  'documentMessage',
  'imageMessage',
  'stickerMessage',
  'videoMessage',
])

const MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'video/3gpp': '3gp',
  'video/mp4': 'mp4',
}

// Baileys only requires a pino-compatible logger. Keep its protocol chatter
// quiet and surface meaningful connection/message events through our logger.
const silentLogger = {
  level: 'silent',
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  child() { return this },
}

function formatPairingCode(code) {
  return String(code || '').match(/.{1,4}/g)?.join('-') || String(code || '')
}

function statusCode(errorValue) {
  return errorValue?.output?.statusCode ||
    errorValue?.data?.statusCode ||
    errorValue?.statusCode
}

function contentText(content, contentType) {
  switch (contentType) {
    case 'conversation':
      return content.conversation || ''
    case 'extendedTextMessage':
      return content.extendedTextMessage?.text || ''
    case 'imageMessage':
      return content.imageMessage?.caption || '[image]'
    case 'videoMessage':
      return content.videoMessage?.caption || '[video]'
    case 'audioMessage':
      return content.audioMessage?.ptt ? '[voice message]' : '[audio]'
    case 'documentMessage':
      return content.documentMessage?.caption ||
        `[document: ${content.documentMessage?.fileName || 'file'}]`
    case 'stickerMessage':
      return '[sticker]'
    case 'contactMessage':
      return `[contact: ${content.contactMessage?.displayName || 'unknown'}]\n` +
        `${content.contactMessage?.vcard || ''}`
    case 'contactsArrayMessage':
      return (content.contactsArrayMessage?.contacts || [])
        .map(contact => `[contact: ${contact.displayName || 'unknown'}]\n${contact.vcard || ''}`)
        .join('\n')
    case 'locationMessage': {
      const location = content.locationMessage || {}
      const label = location.name || location.address || 'Shared location'
      return `${label}: https://maps.google.com/?q=${location.degreesLatitude},${location.degreesLongitude}`
    }
    case 'liveLocationMessage': {
      const location = content.liveLocationMessage || {}
      return `Live location: https://maps.google.com/?q=${location.degreesLatitude},${location.degreesLongitude}`
    }
    case 'buttonsResponseMessage':
      return content.buttonsResponseMessage?.selectedDisplayText ||
        content.buttonsResponseMessage?.selectedButtonId || ''
    case 'templateButtonReplyMessage':
      return content.templateButtonReplyMessage?.selectedDisplayText ||
        content.templateButtonReplyMessage?.selectedId || ''
    case 'listResponseMessage':
      return content.listResponseMessage?.title ||
        content.listResponseMessage?.singleSelectReply?.selectedRowId || ''
    case 'interactiveResponseMessage':
      return content.interactiveResponseMessage?.body?.text ||
        content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
        '[interactive response]'
    case 'reactionMessage':
      return `Reaction: ${content.reactionMessage?.text || '(removed)'}`
    case 'pollCreationMessage':
    case 'pollCreationMessageV2':
    case 'pollCreationMessageV3':
      return `[poll: ${content[contentType]?.name || 'untitled'}]`
    case 'protocolMessage':
      return '[WhatsApp protocol update]'
    default:
      return contentType ? `[${contentType}]` : '[unsupported WhatsApp message]'
  }
}

/**
 * XMPP bridge backed by Baileys v7+ (the unofficial WhatsApp Web protocol).
 *
 * XMPP messages may be plain text or JSON:
 *   { "to": "15551234567", "text": "Hello" }
 *   { "to": "15551234567", "content": { "image": { "url": "..." } } }
 *
 * The account is linked on first start by QR code or `pairingNumber`, and its
 * credentials are persisted below `authDir/<bridge-id>`.
 */
export default class Baileys extends Connector {
  constructor(args) {
    super(args)
    verbose('Baileys bridge constructed')

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

    // The bridge container already mounts /tmp/recordings as a persistent
    // volume. Keep sessions there by default so image rebuilds do not unpair.
    const authRoot = this.options.authDir || '/tmp/recordings/baileys_sessions'
    this.authDir = path.resolve(authRoot, this.bridge._id.toString())
    this.socket = null
    this.connected = false
    this.connectionWaiters = new Set()
    this.saveCreds = null
    this.reconnectTimer = null
    this.reconnectAttempt = 0
    this.lastSender = null
    this.stopping = false
    this.pairingCodeRequested = false
    this.processedMessageIds = new Set()
    this.sentMessageIds = new Set()
    this.messageStore = new Map()
  }

  get options() {
    return this.bridge.options.baileys || {}
  }

  async start() {
    await super.start()
    verbose('Baileys bridge starting')

    try {
      fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 })
      fs.chmodSync(this.authDir, 0o700)

      this.xmppAgent.chat = async ({ prompt } = {}) => {
        try {
          await this.sendFromXmpp(prompt)
        } catch (err) {
          error('Failed to send Baileys WhatsApp message:', err)
          await this.slog('error', 'Failed to send Baileys WhatsApp message', {
            error: err.toString(),
          })
        }
        return ''
      }

      await this.xmppAgent.start()
      await this.connect()
      await this.slog('info', 'Baileys bridge started', {
        authDir: this.authDir,
      })
    } catch (err) {
      error('Error starting Baileys bridge:', err)
      await this.slog('error', 'Error starting Baileys bridge', {
        error: err.toString(),
      })
      await this.stop()
    }
  }

  async connect() {
    if (this.stopping) return
    this.clearReconnectTimer()
    this.connected = false

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    this.saveCreds = saveCreds

    const socket = makeWASocket({
      auth: state,
      logger: silentLogger,
      browser: Browsers.ubuntu(this.options.browserName || 'HyperAgency'),
      // Baileys v7 deprecated its own terminal renderer. QR updates are
      // rendered explicitly in handleConnectionUpdate instead.
      printQRInTerminal: false,
      markOnlineOnConnect: this.options.markOnlineOnConnect === true,
      emitOwnEvents: true,
      syncFullHistory: this.options.syncFullHistory === true,
      shouldSyncHistoryMessage: () => this.options.syncFullHistory === true,
      getMessage: async key => this.getStoredMessage(key),
    })
    this.socket = socket

    socket.ev.on('creds.update', saveCreds)
    socket.ev.on('connection.update', update => {
      void this.handleConnectionUpdate(socket, update)
    })
    socket.ev.on('messages.upsert', event => {
      void this.handleMessages(socket, event)
    })

    if (!state.creds.registered && this.options.pairingNumber && !this.pairingCodeRequested) {
      const number = String(this.options.pairingNumber).replace(/\D/g, '')
      if (!number) throw new Error('Baileys pairingNumber must contain a country code and digits')
      this.pairingCodeRequested = true
      const code = await socket.requestPairingCode(number)
      log(`Baileys pairing code for ${this.bridge.options.name}:`, formatPairingCode(code))
      await this.slog('warn', 'Baileys account requires pairing; see bridge console')
    }
  }

  async handleConnectionUpdate(socket, update) {
    if (this.socket !== socket || this.stopping) return

    if (update.qr && !this.options.pairingNumber) {
      if (this.options.printQRInTerminal !== false) {
        log(`Scan the Baileys QR code for bridge ${this.bridge.options.name}:`)
        qrcode.generate(update.qr, { small: true }, rendered => {
          console.log(rendered)
        })
      } else {
        warn(`Baileys QR pairing is required for ${this.bridge.options.name}, but terminal QR output is disabled`)
      }
      await this.slog('warn', 'Baileys account requires QR pairing; see bridge console')
    }

    if (update.connection === 'open') {
      this.connected = true
      this.reconnectAttempt = 0
      this.pairingCodeRequested = false
      this.resolveConnectionWaiters(socket)
      log(`Baileys connected: ${socket.user?.name || socket.user?.id || this.bridge.options.name}`)
      await this.slog('info', 'Baileys connected', {
        whatsappId: socket.user?.id,
        whatsappName: socket.user?.name,
      })
      return
    }

    if (update.connection !== 'close') return

    const code = statusCode(update.lastDisconnect?.error)
    this.connected = false
    this.socket = null
    this.pairingCodeRequested = false
    if (code === DisconnectReason.loggedOut) {
      error(`Baileys session logged out for bridge ${this.bridge.options.name}; remove its auth directory before pairing again`)
      this.rejectConnectionWaiters(new Error('Baileys session is logged out'))
      await this.slog('error', 'Baileys session logged out; clear its auth directory before pairing again')
      return
    }

    warn(`Baileys connection closed for ${this.bridge.options.name}; scheduling reconnect`, code)
    this.scheduleReconnect()
  }

  scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) return
    const base = Number(this.options.reconnectDelayMs) || 2000
    const delay = Math.min(base * (2 ** this.reconnectAttempt), 60_000)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(err => {
        error('Baileys reconnect failed:', err)
        this.scheduleReconnect()
      })
    }, delay)
  }

  clearReconnectTimer() {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  waitForConnection(timeoutMs = Number(this.options.sendTimeoutMs) || 60_000) {
    if (this.connected && this.socket?.user) return Promise.resolve(this.socket)
    if (this.stopping) return Promise.reject(new Error('Baileys bridge is stopping'))

    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null }
      waiter.timer = setTimeout(() => {
        this.connectionWaiters.delete(waiter)
        reject(new Error('Timed out waiting for Baileys to connect to WhatsApp'))
      }, timeoutMs)
      this.connectionWaiters.add(waiter)
    })
  }

  resolveConnectionWaiters(socket) {
    for (const waiter of this.connectionWaiters) {
      clearTimeout(waiter.timer)
      waiter.resolve(socket)
    }
    this.connectionWaiters.clear()
  }

  rejectConnectionWaiters(err) {
    for (const waiter of this.connectionWaiters) {
      clearTimeout(waiter.timer)
      waiter.reject(err)
    }
    this.connectionWaiters.clear()
  }

  isTransientConnectionError(err) {
    return [408, 428, 503, 515].includes(statusCode(err)) ||
      err?.message === 'Connection Closed'
  }

  reconnectAfterSendFailure(socket, err) {
    if (this.socket !== socket) return
    this.connected = false
    socket.end(err).catch(() => {})
    this.scheduleReconnect()
  }

  async handleMessages(socket, { type, messages }) {
    if (this.socket !== socket || this.stopping || type !== 'notify') return

    for (const message of messages || []) {
      try {
        this.storeMessage(message)
        if (!message.message || !message.key?.remoteJid) continue
        if (message.key.remoteJid === 'status@broadcast') continue
        if (this.options.ignoreGroups && message.key.remoteJid.endsWith('@g.us')) continue

        const messageId = message.key.id
        // Messages authored on the linked phone also have fromMe=true. Ignore
        // only IDs sent by this bridge, otherwise mobile-originated messages
        // from the same WhatsApp account would never reach XMPP.
        if (messageId && this.sentMessageIds.has(messageId)) continue
        if (messageId && this.processedMessageIds.has(messageId)) continue
        if (messageId) this.rememberMessageId(messageId)

        const content = extractMessageContent(message.message)
        const contentType = getContentType(content)
        if (!content || !contentType) continue

        const chatJid = message.key.remoteJid
        const senderJid = message.key.participant ||
          message.key.participantAlt ||
          message.key.remoteJidAlt ||
          chatJid
        this.lastSender = chatJid

        let prompt = `💬 WhatsApp from ${message.pushName || senderJid}`
        if (chatJid.endsWith('@g.us')) prompt += ` in ${chatJid}`
        prompt += `\n${contentText(content, contentType)}`

        if (MEDIA_TYPES.has(contentType) && this.options.downloadMedia !== false) {
          const mediaUrl = await this.copyMediaToXmpp(socket, message, content, contentType)
          if (mediaUrl) prompt += `\n${mediaUrl}`
        }

        await this.forwardToXmpp(prompt)
        if (this.options.markAsRead !== false && !message.key.fromMe) {
          await socket.readMessages([message.key]).catch(err => {
            warn('Could not mark Baileys message as read:', err)
          })
        }
        await this.slog('info', 'Received Baileys WhatsApp message', {
          chatJid,
          senderJid,
          messageId,
          type: contentType,
        })
      } catch (err) {
        error('Failed to process Baileys WhatsApp message:', err)
        await this.slog('error', 'Failed to process Baileys WhatsApp message', {
          error: err.toString(),
          messageId: message.key?.id,
        })
      }
    }
  }

  async forwardToXmpp(prompt) {
    if (this.bridge.options.enablePersonal) {
      await this.xmppAgent.xmppClient.sendPersonalMessage({
        recipient: this.bridge.options.recipient,
        prompt,
      })
    }
    if (this.bridge.options.enableRoom && this.bridge.options.joinRooms?.length > 0) {
      await this.xmppAgent.xmppClient.sendRoomMessage({
        room: this.bridge.options.joinRooms[0],
        recipient: this.bridge.options.recipientNickname,
        prompt,
        mucHost: conf.xmpp.mucHost,
      })
    }
  }

  async copyMediaToXmpp(socket, message, content, contentType) {
    try {
      const media = content[contentType]
      const buffer = await downloadMediaMessage(message, 'buffer', {}, {
        logger: silentLogger,
        reuploadRequest: mediaMessage => socket.updateMediaMessage(mediaMessage),
      })
      const mimeType = media?.mimetype || 'application/octet-stream'
      const extension = MIME_EXTENSIONS[mimeType] || 'bin'
      const kind = contentType.replace(/Message$/, '')
      const filename = media?.fileName || `${kind}-${message.key.id}.${extension}`
      return await this.xmppAgent.xmppClient.uploadFile({
        buffer,
        filename,
        size: buffer.length,
        contentType: mimeType,
        shareHost: conf.xmpp.shareHost,
      })
    } catch (err) {
      warn('Could not copy Baileys media to XMPP:', err)
      return null
    }
  }

  normalizeRecipient(recipient) {
    const value = String(recipient || '').trim()
    if (!value) return ''
    if (value.includes('@')) return value
    const number = value.replace(/\D/g, '')
    return number ? `${number}@s.whatsapp.net` : ''
  }

  async sendFromXmpp(prompt) {
    let parsed
    try {
      parsed = JSON.parse(prompt)
    } catch {
      parsed = null
    }

    let recipient
    let content
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      recipient = parsed.to
      if (parsed.content && typeof parsed.content === 'object') {
        content = parsed.content
      } else if (parsed.text && typeof parsed.text === 'object') {
        content = parsed.text
      } else {
        content = { text: String(parsed.text ?? '') }
      }
    } else {
      content = { text: String(prompt || '') }
    }

    recipient = this.normalizeRecipient(
      recipient || this.options.defaultRecipient || this.lastSender
    )
    if (!recipient) {
      throw new Error('Baileys recipient is required; set defaultRecipient or provide "to"')
    }
    if (Object.keys(content).length === 1 && 'text' in content && !content.text) {
      throw new Error('Baileys text message cannot be empty')
    }

    let socket = await this.waitForConnection()
    try {
      return await this.sendMessage(socket, recipient, content)
    } catch (err) {
      if (!this.isTransientConnectionError(err)) throw err

      warn('Baileys send interrupted by a reconnect; waiting to retry once')
      this.reconnectAfterSendFailure(socket, err)
      socket = await this.waitForConnection()
      return await this.sendMessage(socket, recipient, content)
    }
  }

  async sendMessage(socket, recipient, content) {
    const messageId = generateMessageIDV2(socket.user.id)
    this.rememberSentMessageId(messageId)
    let response
    try {
      response = await socket.sendMessage(recipient, content, { messageId })
    } catch (err) {
      this.sentMessageIds.delete(messageId)
      throw err
    }
    if (response?.key?.id) this.rememberSentMessageId(response.key.id)
    if (response) this.storeMessage(response)
    await this.slog('info', 'Sent Baileys WhatsApp message', {
      to: recipient,
      messageId: response?.key?.id,
      type: Object.keys(content)[0],
    })
    return response
  }

  messageStoreKey(key) {
    return `${key?.remoteJid || ''}:${key?.id || ''}`
  }

  storeMessage(message) {
    if (!message?.key?.id) return
    this.messageStore.set(this.messageStoreKey(message.key), message)
    if (this.messageStore.size > 1000) {
      const oldest = this.messageStore.keys().next().value
      this.messageStore.delete(oldest)
    }
  }

  getStoredMessage(key) {
    return this.messageStore.get(this.messageStoreKey(key))?.message
  }

  rememberMessageId(messageId) {
    this.processedMessageIds.add(messageId)
    if (this.processedMessageIds.size > 1000) {
      const oldest = this.processedMessageIds.values().next().value
      this.processedMessageIds.delete(oldest)
    }
  }

  rememberSentMessageId(messageId) {
    this.sentMessageIds.add(messageId)
    if (this.sentMessageIds.size > 1000) {
      const oldest = this.sentMessageIds.values().next().value
      this.sentMessageIds.delete(oldest)
    }
  }

  async stop() {
    this.stopping = true
    this.connected = false
    this.clearReconnectTimer()
    this.rejectConnectionWaiters(new Error('Baileys bridge stopped'))
    await super.stop()

    const socket = this.socket
    this.socket = null
    if (socket) {
      socket.ev.removeAllListeners('connection.update')
      socket.ev.removeAllListeners('messages.upsert')
      socket.ev.removeAllListeners('creds.update')
      await socket.end(new Error('Bridge stopped')).catch(() => {})
    }
    await this.xmppAgent.stop().catch(() => {})
    verbose('Baileys bridge stopped')
    await this.slog('debug', 'Bridge stopped')
  }
}
