import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

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
import {
  DurableOutbox,
  XmppAttachmentCollector,
  downloadAttachments,
  forwardEnvelopeToXmpp,
  isXmppFileUrl,
  makeInboundEnvelope,
  parseXmppPayload,
} from './omnichannel.js'

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

function filesystemSlug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'bridge'
}

function formatPairingCode(code) {
  const rawCode = String(code || '').replace(/[^a-z0-9]/gi, '')
  return rawCode.match(/.{1,4}/g)?.join('-') || rawCode
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
      return ''
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
 * credentials are persisted below
 * `authDir/<bridge-id>-<filesystem-safe-bridge-name>`.
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
    this.authRoot = path.resolve(
      this.options.authDir || '/tmp/recordings/baileys_sessions'
    )
    this.bridgeId = this.bridge._id.toString()
    this.sessionDirectoryName =
      `${this.bridgeId}-${filesystemSlug(this.bridge.options.name)}`
    this.authDir = path.join(this.authRoot, this.sessionDirectoryName)
    this.socket = null
    this.connected = false
    this.connectionWaiters = new Set()
    this.saveCreds = null
    this.reconnectTimer = null
    this.reconnectAttempt = 0
    this.lastSender = null
    this.stopping = false
    this.pairingCodeRequestSocket = null
    this.pairingCodeDisplayedSocket = null
    this.qrCodeDisplayedSocket = null
    this.processedMessageIds = new Set()
    this.sentMessageIds = new Set()
    this.messageStore = new Map()
    this.attachmentCollector = new XmppAttachmentCollector()
    this.outbox = null
  }

  get options() {
    return this.bridge.options.baileys || {}
  }

  async prepareAuthDirectory() {
    fs.mkdirSync(this.authRoot, { recursive: true, mode: 0o700 })

    if (!fs.existsSync(this.authDir)) {
      const existingDirectories = fs.readdirSync(this.authRoot, {
        withFileTypes: true,
      }).filter(entry =>
        entry.isDirectory() &&
        !entry.name.includes('.logged-out-') &&
        (entry.name === this.bridgeId || entry.name.startsWith(`${this.bridgeId}-`))
      )

      // Preserve an existing session when upgrading from ID-only directory
      // names or when the bridge has been renamed. Only migrate an
      // unambiguous source so we never select the wrong WhatsApp account.
      if (existingDirectories.length === 1) {
        const oldDirectoryName = existingDirectories[0].name
        fs.renameSync(
          path.join(this.authRoot, oldDirectoryName),
          this.authDir
        )
        log(
          `Renamed Baileys session directory for ${this.bridge.options.name}:`,
          `${oldDirectoryName} -> ${this.sessionDirectoryName}`
        )
        await this.slog(
          'info',
          `Renamed Baileys session directory: ${oldDirectoryName} -> ` +
          this.sessionDirectoryName,
          {
            previousDirectory: path.join(this.authRoot, oldDirectoryName),
            authDir: this.authDir,
          }
        )
      } else if (existingDirectories.length > 1) {
        warn(
          `Multiple Baileys session directories match bridge ${this.bridgeId}; ` +
          `using ${this.sessionDirectoryName} without migrating them`
        )
        await this.slog(
          'warn',
          'Multiple Baileys session directories found; no session was migrated',
          {
            authDir: this.authDir,
            matchingDirectories: existingDirectories.map(entry =>
              path.join(this.authRoot, entry.name)
            ),
          }
        )
      }
    }

    fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 })
    fs.chmodSync(this.authDir, 0o700)
    log(`Baileys session directory for ${this.bridge.options.name}: ${this.authDir}`)
    await this.slog('info', `Baileys session directory: ${this.authDir}`, {
      authDir: this.authDir,
    })
  }

  archiveLoggedOutAuthDirectory() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 })
      fs.chmodSync(this.authDir, 0o700)
      return null
    }

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '')
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(3).toString('hex')
      const backupDirectory =
        `${this.authDir}.logged-out-${timestamp}-${suffix}`

      try {
        // The backup is a sibling of the active directory, so this is an
        // atomic rename on the same mounted filesystem.
        fs.renameSync(this.authDir, backupDirectory)
        fs.chmodSync(backupDirectory, 0o700)
        fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 })
        fs.chmodSync(this.authDir, 0o700)
        return backupDirectory
      } catch (err) {
        if (!['EEXIST', 'ENOTEMPTY'].includes(err.code)) throw err
      }
    }

    throw new Error(
      `Could not create a unique backup name for Baileys session ${this.authDir}`
    )
  }

  async start() {
    await super.start()
    verbose('Baileys bridge starting')

    try {
      await this.prepareAuthDirectory()

      this.outbox = new DurableOutbox({
        bridgeId: this.bridge._id.toString(),
        config: conf.baileys,
        deliver: payload => this.sendFromXmpp(payload.prompt, payload.attachmentUrls),
        onState: (state, job) => this.logOutboxState(state, job),
      })
      this.outbox.start()

      this.xmppAgent.chat = async ({ prompt, from } = {}) => {
        if (isXmppFileUrl(prompt)) {
          this.attachmentCollector.add(from, prompt)
          return ''
        }
        const attachmentUrls = this.attachmentCollector.take(from)
        const job = await this.outbox.enqueue({ prompt, attachmentUrls })
        await this.slog('info', 'Queued XMPP message for Baileys delivery', {
          outboxJobId: job.id,
          attachmentCount: attachmentUrls.length,
        })
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
    await this.slog('info', 'Connecting Baileys to WhatsApp', {
      authDir: this.authDir,
      reconnectAttempt: this.reconnectAttempt,
    })

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
    socket.ev.on('messages.update', updates => {
      for (const update of updates || []) {
        void this.slog('info', 'Baileys WhatsApp message status updated', {
          messageId: update.key?.id,
          recipient: update.key?.remoteJid,
          status: update.update?.status,
        })
      }
    })

    if (!state.creds.registered && this.options.pairingNumber) {
      const number = String(this.options.pairingNumber).replace(/\D/g, '')
      if (!number) throw new Error('Baileys pairingNumber must contain a country code and digits')
    }
  }

  async requestPairingCodeWhenReady(socket, number) {
    if (this.pairingCodeRequestSocket === socket) return
    this.pairingCodeRequestSocket = socket
    try {
      // makeWASocket returns before its underlying WebSocket is necessarily
      // open. requestPairingCode sends an IQ immediately and fails with 428
      // if invoked during that short interval.
      await socket.waitForSocketOpen()
      if (this.socket !== socket || this.stopping) return

      const code = await socket.requestPairingCode(number)
      // requestPairingCode can resolve after a concurrent close event. A code
      // returned by that old socket is already invalid and must not be shown.
      if (this.socket !== socket || this.stopping) {
        warn(`Discarded stale Baileys pairing code for ${this.bridge.options.name}`)
        await this.slog('warn', 'Discarded stale Baileys pairing code')
        return
      }

      const pairingCode = formatPairingCode(code)
      log(
        `Baileys pairing code for ${this.bridge.options.name}: ${pairingCode} ` +
        '(enter exactly as shown)'
      )
      this.pairingCodeDisplayedSocket = socket
      await this.slog(
        'warn',
        `Baileys pairing code: ${pairingCode}`,
        {
          pairingCode,
          pairingMethod: 'phone-number',
          sensitive: true,
          expiresWhenConnectionCloses: true,
        }
      )
    } catch (err) {
      if (this.pairingCodeRequestSocket === socket) {
        this.pairingCodeRequestSocket = null
      }
      if (this.pairingCodeDisplayedSocket === socket) {
        this.pairingCodeDisplayedSocket = null
      }
      if (this.socket !== socket || this.stopping) return

      error(`Failed to request Baileys pairing code for ${this.bridge.options.name}:`, err)
      await this.slog('error', 'Failed to request Baileys pairing code', {
        error: err.toString(),
      })
      if (this.isTransientConnectionError(err)) {
        this.reconnectAfterSendFailure(socket, err)
      }
    }
  }

  async handleConnectionUpdate(socket, update) {
    if (this.socket !== socket || this.stopping) return

    if (update.qr) {
      const renderedQrCode = await new Promise(resolve => {
        qrcode.generate(update.qr, { small: true }, resolve)
      })
      const qrMessage =
        `Scan this Baileys QR code for bridge ${this.bridge.options.name}:\n` +
        renderedQrCode

      await this.slog('warn', qrMessage, {
        pairingMethod: 'qr',
        qrCode: renderedQrCode,
        qrData: update.qr,
        sensitive: true,
        expiresWhenConnectionCloses: true,
      })
      this.qrCodeDisplayedSocket = socket

      if (this.options.printQRInTerminal !== false) {
        log(`Scan the Baileys QR code for bridge ${this.bridge.options.name}:`)
        console.log(renderedQrCode)
      }

      if (this.options.pairingNumber) {
        // A pairing code is only valid after WhatsApp has sent the QR
        // handshake data for this socket. Requesting it merely when the raw
        // WebSocket opens can produce codes the mobile app rejects.
        const number = String(this.options.pairingNumber).replace(/\D/g, '')
        await this.requestPairingCodeWhenReady(socket, number)
      } else {
        if (this.options.printQRInTerminal === false) {
          warn(`Baileys QR pairing is required for ${this.bridge.options.name}, but terminal QR output is disabled`)
        }
      }
    }

    if (update.connection === 'open') {
      this.connected = true
      this.reconnectAttempt = 0
      if (this.pairingCodeRequestSocket === socket) {
        this.pairingCodeRequestSocket = null
      }
      if (this.pairingCodeDisplayedSocket === socket) {
        this.pairingCodeDisplayedSocket = null
      }
      if (this.qrCodeDisplayedSocket === socket) {
        this.qrCodeDisplayedSocket = null
      }
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
    if (this.pairingCodeRequestSocket === socket) {
      this.pairingCodeRequestSocket = null
    }
    if (this.pairingCodeDisplayedSocket === socket) {
      const message =
        `The previous Baileys pairing code for ${this.bridge.options.name} ` +
        'expired when its connection closed; wait for a new code'
      warn(message)
      await this.slog('warn', message)
      this.pairingCodeDisplayedSocket = null
    }
    if (this.qrCodeDisplayedSocket === socket) {
      const message =
        `The previous Baileys QR code for ${this.bridge.options.name} ` +
        'expired when its connection closed; wait for a new QR code'
      warn(message)
      await this.slog('warn', message)
      this.qrCodeDisplayedSocket = null
    }
    if (code === DisconnectReason.loggedOut) {
      this.rejectConnectionWaiters(new Error('Baileys session is logged out'))
      // Prevent the old saveCreds callback from recreating or modifying the
      // session directory after it has been archived.
      socket.ev.removeAllListeners('creds.update')
      socket.ev.removeAllListeners('messages.upsert')
      socket.ev.removeAllListeners('messages.update')

      try {
        const backupDirectory = this.archiveLoggedOutAuthDirectory()
        warn(
          `Baileys session logged out for bridge ${this.bridge.options.name}; ` +
          (backupDirectory
            ? `archived it as ${backupDirectory}`
            : `created a fresh session directory at ${this.authDir}`)
        )
        const sessionMessage = backupDirectory
          ? `Baileys logged-out session archived as ${backupDirectory}; starting fresh pairing`
          : `Baileys fresh session directory created at ${this.authDir}; starting pairing`
        await this.slog(
          'warn',
          sessionMessage,
          {
            authDir: this.authDir,
            backupDirectory,
          }
        )
        this.scheduleReconnect()
      } catch (err) {
        error(
          `Failed to archive logged-out Baileys session for ${this.bridge.options.name}:`,
          err
        )
        await this.slog(
          'error',
          'Failed to archive logged-out Baileys session',
          {
            authDir: this.authDir,
            error: err.toString(),
          }
        )
      }
      return
    }

    warn(`Baileys connection closed for ${this.bridge.options.name}; scheduling reconnect`, code)
    await this.slog('warn', 'Baileys connection closed; scheduling reconnect', {
      disconnectCode: code,
    })
    this.scheduleReconnect()
  }

  scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) return
    const base = Number(this.options.reconnectDelayMs) || 2000
    const delay = Math.min(base * (2 ** this.reconnectAttempt), 60_000)
    this.reconnectAttempt += 1
    this.slog('info', 'Baileys reconnect scheduled', {
      delayMs: delay,
      reconnectAttempt: this.reconnectAttempt,
    })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(err => {
        error('Baileys reconnect failed:', err)
        this.slog('error', 'Baileys reconnect failed', {
          error: err.toString(),
        })
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
      const eventMessageId = message.key?.id
      try {
        this.storeMessage(message)
        if (!message.message || !message.key?.remoteJid) continue
        if (message.key.remoteJid === 'status@broadcast') continue
        if (this.options.ignoreGroups && message.key.remoteJid.endsWith('@g.us')) continue

        const messageId = eventMessageId
        // Messages authored on the linked phone also have fromMe=true. Ignore
        // only IDs sent by this bridge, otherwise mobile-originated messages
        // from the same WhatsApp account would never reach XMPP.
        if (messageId && this.sentMessageIds.has(messageId)) continue
        if (messageId && this.processedMessageIds.has(messageId)) continue
        if (messageId) this.rememberMessageId(messageId)

        const content = extractMessageContent(message.message)
        const contentType = getContentType(content)
        if (!content || !contentType) continue
        if (contentType === 'protocolMessage') continue

        const chatJid = message.key.remoteJid
        const senderJid = message.key.participant ||
          message.key.participantAlt ||
          message.key.remoteJidAlt ||
          chatJid
        this.lastSender = chatJid

        const text = contentText(content, contentType)
        let prompt = `💬 WhatsApp from ${message.pushName || senderJid}`
        if (chatJid.endsWith('@g.us')) prompt += ` in ${chatJid}`
        prompt += `\n${text}`
        const attachments = []
        if (MEDIA_TYPES.has(contentType) && this.options.downloadMedia !== false) {
          const attachment = await this.downloadMedia(
            socket, message, content, contentType
          )
          if (attachment) attachments.push(attachment)
        }

        const timestampValue = message.messageTimestamp?.toNumber?.() ||
          Number(message.messageTimestamp) ||
          Math.floor(Date.now() / 1000)
        const from = String(senderJid).split('@')[0]
        const to = String(socket.user?.id || '').split(':')[0]
        const envelope = makeInboundEnvelope({
          channel: 'whatsapp',
          externalMessageId: messageId,
          conversationId: chatJid,
          from,
          fromName: message.pushName || null,
          to,
          timestamp: new Date(timestampValue * 1000).toISOString(),
          text,
          fromMe: message.key.fromMe === true,
          extra: {
            provider: 'baileys',
            whatsappJid: senderJid,
            groupJid: chatJid.endsWith('@g.us') ? chatJid : null,
          },
        })
        await forwardEnvelopeToXmpp({
          bridge: this.bridge,
          xmppAgent: this.xmppAgent,
          options: this.options,
          envelope,
          humanText: prompt,
          attachments,
        })
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
        // Allow Baileys to redeliver the event when forwarding to XMPP failed.
        if (eventMessageId) this.processedMessageIds.delete(eventMessageId)
        error('Failed to process Baileys WhatsApp message:', err)
        await this.slog('error', 'Failed to process Baileys WhatsApp message', {
          error: err.toString(),
          messageId: message.key?.id,
        })
      }
    }
  }

  async downloadMedia(socket, message, content, contentType) {
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
      return {
        buffer,
        filename,
        contentType: mimeType,
      }
    } catch (err) {
      warn('Could not copy Baileys media to XMPP:', err)
      throw err
    }
  }

  normalizeRecipient(recipient) {
    const value = String(recipient || '').trim()
    if (!value) return ''
    if (value.includes('@')) return value
    const number = value.replace(/\D/g, '')
    return number ? `${number}@s.whatsapp.net` : ''
  }

  async sendFromXmpp(prompt, attachmentUrls = []) {
    const parsed = parseXmppPayload(prompt)

    let recipient
    let content
    if (parsed) {
      recipient = parsed.to
      if (parsed.content && typeof parsed.content === 'object') {
        content = parsed.content
      } else if (parsed.text && typeof parsed.text === 'object') {
        content = parsed.text
      } else {
        content = { text: String(parsed.text ?? '') }
      }
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

    const embeddedUrls = Array.isArray(parsed.attachments)
      ? parsed.attachments
        .map(item => typeof item === 'string' ? item : item?.url)
        .filter(Boolean)
      : []
    const attachments = await downloadAttachments([
      ...attachmentUrls,
      ...embeddedUrls,
    ])

    let socket = await this.waitForConnection()
    try {
      for (const attachment of attachments) {
        await this.sendMessage(
          socket,
          recipient,
          this.baileysAttachmentContent(attachment)
        )
      }
      return await this.sendMessage(socket, recipient, content)
    } catch (err) {
      if (!this.isTransientConnectionError(err)) throw err

      warn('Baileys send interrupted by a reconnect; waiting to retry once')
      this.reconnectAfterSendFailure(socket, err)
      socket = await this.waitForConnection()
      for (const attachment of attachments) {
        await this.sendMessage(
          socket,
          recipient,
          this.baileysAttachmentContent(attachment)
        )
      }
      return await this.sendMessage(socket, recipient, content)
    }
  }

  baileysAttachmentContent(attachment) {
    if (attachment.contentType.startsWith('image/')) {
      return { image: attachment.buffer, mimetype: attachment.contentType }
    }
    if (attachment.contentType.startsWith('video/')) {
      return { video: attachment.buffer, mimetype: attachment.contentType }
    }
    if (attachment.contentType.startsWith('audio/')) {
      return { audio: attachment.buffer, mimetype: attachment.contentType }
    }
    return {
      document: attachment.buffer,
      mimetype: attachment.contentType,
      fileName: attachment.filename,
    }
  }

  async logOutboxState(state, job) {
    const level = state === 'failed' ? 'error' : state === 'retrying' ? 'warn' : 'info'
    await this.slog(level, `Baileys outbox job ${state}`, {
      outboxJobId: job.id,
      attempts: job.attempts,
      error: job.lastError,
    })
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
    this.outbox?.stop()
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
