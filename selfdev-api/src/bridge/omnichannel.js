import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import https from 'https'

import axios from 'axios'

import conf from '../conf.js'

const MIME_BY_EXTENSION = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

function cleanString(value) {
  return String(value == null ? '' : value).trim()
}

export function isXmppFileUrl(value) {
  const candidate = cleanString(value)
  if (!candidate || candidate.includes('\n') || /\s/.test(candidate)) return false
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return candidate.startsWith(conf.xmpp.shareUrlPrefix) ||
      url.pathname.includes('/file_share/') ||
      url.pathname.includes('/v1/files/')
  } catch {
    return false
  }
}

export class XmppAttachmentCollector {
  constructor({ ttlMs = 30 * 60 * 1000 } = {}) {
    this.ttlMs = ttlMs
    this.pending = new Map()
  }

  add(sender, url) {
    this.prune()
    const key = cleanString(sender) || 'default'
    const current = this.pending.get(key) || { urls: [], updatedAt: Date.now() }
    current.urls.push(cleanString(url))
    current.updatedAt = Date.now()
    this.pending.set(key, current)
  }

  take(sender) {
    this.prune()
    const key = cleanString(sender) || 'default'
    const current = this.pending.get(key)
    this.pending.delete(key)
    return current?.urls || []
  }

  prune() {
    const cutoff = Date.now() - this.ttlMs
    for (const [key, value] of this.pending) {
      if (value.updatedAt < cutoff) this.pending.delete(key)
    }
  }
}

export function parseXmppPayload(prompt) {
  try {
    const parsed = JSON.parse(prompt)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {}
  return { text: String(prompt || '') }
}

export function messageFormat(options = {}) {
  return options.messageFormat === 'json' ? 'json' : 'human'
}

export function makeInboundEnvelope({
  channel,
  externalMessageId,
  conversationId,
  from,
  fromName,
  to,
  timestamp,
  text,
  attachments = [],
  fromMe = false,
  extra = {},
}) {
  return {
    schemaVersion: 'h9y.omnichannel.v1',
    eventType: 'message',
    direction: fromMe ? 'outbound' : 'inbound',
    fromMe,
    channel,
    bridgeMessageId: externalMessageId || crypto.randomUUID(),
    externalMessageId: externalMessageId || null,
    conversationId: conversationId || null,
    from: from || null,
    fromName: fromName || null,
    to: to || null,
    timestamp: timestamp || new Date().toISOString(),
    text: text || '',
    attachments: attachments.map(attachment => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      url: attachment.url,
    })),
    ...extra,
  }
}

export function renderInboundPayload({ options, envelope, humanText }) {
  return messageFormat(options) === 'json'
    ? JSON.stringify(envelope)
    : humanText
}

async function sendXmppMessage({ bridge, xmppAgent, prompt }) {
  if (bridge.options.enablePersonal) {
    await xmppAgent.xmppClient.sendPersonalMessage({
      recipient: bridge.options.recipient,
      prompt,
    })
  }
  if (bridge.options.enableRoom && bridge.options.joinRooms?.length > 0) {
    await xmppAgent.xmppClient.sendRoomMessage({
      room: bridge.options.joinRooms[0],
      recipient: bridge.options.recipientNickname,
      prompt,
      mucHost: conf.xmpp.mucHost,
    })
  }
}

/**
 * HyperAgency attachment framing over XMPP:
 *   1. one URL-only stanza per uploaded file;
 *   2. one final stanza containing the JSON or human-readable message.
 */
export async function forwardEnvelopeToXmpp({
  bridge,
  xmppAgent,
  options,
  envelope,
  humanText,
  attachments = [],
}) {
  const uploaded = []
  for (const attachment of attachments) {
    const buffer = attachment.buffer || fs.readFileSync(attachment.path)
    const filename = attachment.filename || `attachment-${uploaded.length + 1}`
    const contentType = attachment.contentType || mimeTypeForFilename(filename)
    const url = await xmppAgent.xmppClient.uploadFile({
      buffer,
      filename,
      size: buffer.length,
      contentType,
      shareHost: conf.xmpp.shareHost,
    })
    const metadata = {
      filename,
      contentType,
      size: buffer.length,
      url,
    }
    uploaded.push(metadata)
    await sendXmppMessage({ bridge, xmppAgent, prompt: url })
  }

  const finalEnvelope = { ...envelope, attachments: uploaded }
  const prompt = renderInboundPayload({
    options,
    envelope: finalEnvelope,
    humanText,
  })
  await sendXmppMessage({ bridge, xmppAgent, prompt })
  return finalEnvelope
}

export function filenameFromUrl(url, fallback = 'attachment') {
  try {
    const filename = decodeURIComponent(path.basename(new URL(url).pathname))
    return filename || fallback
  } catch {
    return fallback
  }
}

export function mimeTypeForFilename(filename) {
  const extension = path.extname(filename || '').slice(1).toLowerCase()
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream'
}

export async function downloadAttachment(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    httpsAgent: process.env.SSL_VERIFY === 'false'
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined,
  })
  const filename = filenameFromUrl(url)
  return {
    url,
    filename,
    contentType: response.headers['content-type'] || mimeTypeForFilename(filename),
    buffer: Buffer.from(response.data),
  }
}

export async function downloadAttachments(urls = []) {
  const results = []
  for (const url of urls) results.push(await downloadAttachment(url))
  return results
}

function safeBridgeId(value) {
  return String(value || 'bridge').replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Small durable outbox. A job is removed only after the channel confirms that
 * its send API accepted it. Failed jobs survive bridge restarts and are retried
 * with bounded exponential backoff.
 */
export class DurableOutbox {
  constructor({ bridgeId, config, deliver, onState = async () => {} }) {
    this.deliver = deliver
    this.onState = onState
    this.baseDelayMs = Math.max(1, config.retryBaseSeconds) * 1000
    this.maxDelayMs = Math.max(
      this.baseDelayMs,
      config.retryMaxSeconds * 1000
    )
    this.maxAttempts = Math.max(1, config.maxDeliveryAttempts)
    this.directory = path.resolve(
      config.outboxDir,
      safeBridgeId(bridgeId)
    )
    this.timer = null
    this.running = false
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 })
  }

  async enqueue(payload) {
    const job = {
      id: crypto.randomUUID(),
      payload,
      attempts: 0,
      createdAt: new Date().toISOString(),
      nextAttemptAt: new Date().toISOString(),
      lastError: null,
    }
    this.write(job)
    this.schedule(0)
    return job
  }

  start() {
    this.schedule(0)
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  write(job) {
    const target = path.join(this.directory, `${job.id}.json`)
    const temporary = `${target}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(job, null, 2), { mode: 0o600 })
    fs.renameSync(temporary, target)
  }

  list() {
    return fs.readdirSync(this.directory)
      .filter(name => name.endsWith('.json'))
      .map(name => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.directory, name), 'utf8'))
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      )
  }

  schedule(delayMs) {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delayMs)
  }

  async flush() {
    if (this.running) return
    this.running = true
    try {
      for (const job of this.list()) {
        if (job.failedAt) continue
        const waitMs = new Date(job.nextAttemptAt).getTime() - Date.now()
        if (waitMs > 0) {
          this.schedule(waitMs)
          break
        }
        try {
          job.attempts += 1
          await this.deliver(job.payload)
          fs.unlinkSync(path.join(this.directory, `${job.id}.json`))
          await this.onState('delivered', job)
        } catch (err) {
          job.lastError = err?.message || String(err)
          if (job.attempts >= this.maxAttempts) {
            job.failedAt = new Date().toISOString()
            this.write(job)
            await this.onState('failed', job)
            continue
          }
          const delay = Math.min(
            this.baseDelayMs * (2 ** Math.max(0, job.attempts - 1)),
            this.maxDelayMs
          )
          job.nextAttemptAt = new Date(Date.now() + delay).toISOString()
          this.write(job)
          await this.onState('retrying', job)
          this.schedule(delay)
          break
        }
      }
    } finally {
      this.running = false
    }
  }
}
