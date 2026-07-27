import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import fs from 'fs'
import path from 'path'
import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
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

const verbose = Verbose('sd:bridge/email')
verbose('')

export default class Email extends Connector {
  constructor(args) {
    super(args)
    verbose('EmailBridge constructed')

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

    this.mailClient = null
    this.imapOptions = null
    this.smtpTransporter = null
    this.pollInterval = null
    this.checkingInbox = false
    this.attachmentCollector = new XmppAttachmentCollector()
    this.outbox = null
    this.inboundQueue = null
    this.attachmentsDir = path.resolve('./email_attachments')

    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true })
    }
  }

  async ensureConnected() {
    if (this.mailClient?.connected && this.mailClient?.authenticated) return
    if (!this.imapOptions) throw new Error('IMAP options are not configured')

    await this.mailClient?.logout().catch(() => {})
    this.mailClient = new ImapFlow(this.imapOptions)
    log('Reconnecting IMAP with a new client...')
    await this.mailClient.connect()
    await this.slog('info', 'IMAP client reconnected', {
      host: this.imapOptions.host,
    })
  }

  async start() {
    super.start()
    verbose('EmailBridge started')

    const opts = this.bridge.options.email

    /* ---------- IMAP CONNECTION ---------- */
    const imapOptions = {
      host: opts.imap.host,
      port: opts.imap.port || 993,
      secure: opts.imap.secure !== false,
      auth: {
        user: opts.imap.user,
        pass: opts.imap.password,
      },
    }
    this.imapOptions = imapOptions
    // verbose('imapOptions:', imapOptions)
    this.mailClient = new ImapFlow(imapOptions)
    // verbose('mailClient:', this.mailClient)
    // log('mailClient connected (before):', this.mailClient.connected) // boolean
    // log('mailClient authenticated (before):', this.mailClient.authenticated) // boolean

    await this.mailClient.connect()
    // await connectImap(this.mailClient)
    // await ensureConnected(this.mailClient)

    // log('IMAP connected:', opts.imap.host)
    // log('mailClient connected (after):', this.mailClient.connected) // boolean
    // log('mailClient authenticated (after):', this.mailClient.authenticated) // boolean

    this.slog('info', 'IMAP client connected', {
      host: opts.imap.host
    })

    // setInterval(() => {
    //   const c = this.mailClient
    //   if (!c.connected) warn('IMAP not connected')
    //   if (!c.authenticated) warn('IMAP not authenticated')
    // }, 10_000)



    /* ---------- SMTP TRANSPORT ---------- */
    const smtpOptions = {
      host: opts.smtp.host,
      port: opts.smtp.port || 465,
      secure: opts.smtp.secure !== false,
      auth: {
        user: opts.smtp.user,
        pass: opts.smtp.password,
      },
    }
    // verbose('smtpOptions:', smtpOptions)
    this.smtpTransporter = nodemailer.createTransport({
      host: opts.smtp.host,
      port: opts.smtp.port || 465,
      secure: opts.smtp.secure !== false,
      auth: {
        user: opts.smtp.user,
        pass: opts.smtp.password,
      },
    })
    // verbose('smtpTransporter:', this.smtpTransporter)
    log('SMTP ready:', opts.smtp.host)
    this.slog('info', 'SMPT client connected', {
      host: opts.smtp.host,
    })

    await this.xmppAgent.start()

    /* ---------- XMPP → EMAIL ---------- */
    this.outbox = new DurableOutbox({
      bridgeId: this.bridge._id.toString(),
      config: conf.email,
      deliver: payload => this.deliverEmail(payload),
      onState: (state, job) => this.logOutboxState(state, job),
    })
    this.outbox.start()
    this.inboundQueue = createInboundXmppQueue({
      bridge: this.bridge,
      xmppAgent: this.xmppAgent,
      options: opts,
      config: conf.email,
      onState: (state, job) => this.logInboundQueueState(state, job),
    })
    this.inboundQueue.start()

    /* ---------- POLLING LOOP ---------- */
    this.pollInterval = setInterval(
      () => void this.checkInbox(),
      (opts.pollSec || 30) * 1000
    )

    this.xmppAgent.chat = async ({ prompt, from } = {}) => {
      if (isXmppFileUrl(prompt)) {
        this.attachmentCollector.add(from, prompt)
        return ''
      }
      const attachmentUrls = this.attachmentCollector.take(from)
      const job = await this.outbox.enqueue({ prompt, attachmentUrls })
      await this.slog('info', 'Queued XMPP message for SMTP delivery', {
        outboxJobId: job.id,
        attachmentCount: attachmentUrls.length,
      })
      return ''
    }
    this.slog('debug', 'Bridge started')
  }

  async deliverEmail({ prompt, attachmentUrls = [] }) {
    const opts = this.bridge.options.email
    const msg = parseXmppPayload(prompt)
    const attachments = await downloadAttachments([
      ...attachmentUrls,
      ...(Array.isArray(msg.attachments)
        ? msg.attachments
          .map(item => typeof item === 'string' ? item : item?.url)
          .filter(Boolean)
        : []),
    ])
    const mailOptions = {
      from: msg.from || opts.smtp.user,
      to: msg.to || opts.defaultRecipient,
      subject: msg.subject || opts.defaultSubject,
      text: typeof msg.text === 'string' ? msg.text : '',
      attachments: attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.buffer,
        contentType: attachment.contentType,
      })),
    }
    if (!mailOptions.to) throw new Error('Email recipient is required')
    verbose('mailOptions:', {
      ...mailOptions,
      attachments: mailOptions.attachments.map(item => item.filename),
    })
    const result = await this.smtpTransporter.sendMail(mailOptions)
    if ((!result.accepted || result.accepted.length === 0) &&
        result.rejected?.length > 0) {
      throw new Error(`SMTP rejected all recipients: ${result.rejected.join(', ')}`)
    }
    log('Email accepted by SMTP for:', mailOptions.to)
    await this.slog('info', 'Email accepted by SMTP', {
      to: mailOptions.to,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      attachmentCount: attachments.length,
    })
    return result
  }

  async logOutboxState(state, job) {
    const level = state === 'failed' ? 'error' : state === 'retrying' ? 'warn' : 'info'
    await this.slog(level, `Email outbox job ${state}`, {
      outboxJobId: job.id,
      attempts: job.attempts,
      error: job.lastError,
    })
  }

  async logInboundQueueState(state, job) {
    const level = state === 'failed' ? 'error' : state === 'retrying' ? 'warn' : 'info'
    await this.slog(level, `Email inbound XMPP job ${state}`, {
      inboundJobId: job.id,
      attempts: job.attempts,
      error: job.lastError,
    })
  }

  async checkInbox() {
    if (this.checkingInbox) return
    this.checkingInbox = true
    try {
      await this.ensureConnected()
      // Lock the INBOX while processing
      const lock = await this.mailClient.getMailboxLock('INBOX');
      verbose('checkInbox lock acquired');

      try {
        // ✅ Search for all unseen (unread) messages
        const unseenUids = await this.mailClient.search({ seen: false });
        verbose(`Found ${unseenUids.length} unseen emails.`);
        this.slog('info', 'Found unseen emails', {
          number: unseenUids.length,
        })

        for (const uid of unseenUids) {
          verbose(`Processing email UID: ${uid}`);

          // ✅ Fetch full message source and envelope
          const msg = await this.mailClient.fetchOne(uid, { source: true, envelope: true });

          if (!msg?.source) {
            warn(`Email UID ${uid} has no source, skipping.`);
            continue;
          }

          // ✅ Parse email
          const parsed = await simpleParser(msg.source);
          verbose('Parsed email:', {
            subject: parsed.subject,
            from: parsed.from?.text,
            attachments: parsed.attachments?.length || 0,
          });

          // ✅ Save attachments
          const attachments = [];
          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const att of parsed.attachments) {
              const safeName = att.filename || `file-${Date.now()}`;
              const filePath = path.join(this.attachmentsDir, safeName);

              fs.writeFileSync(filePath, att.content);
              attachments.push({
                filename: safeName,
                path: filePath,
                contentType: att.contentType,
              });
              log(`📎 Attachment saved: ${safeName}`);
            }
          }

          // ✅ Construct message text
          const emailText =
            `📧 New Email from ${parsed.from?.text || '(unknown sender)'}\n` +
            `Subject: ${parsed.subject || '(no subject)'}\n\n` +
            `${parsed.text || '(no text)'}\n\n` +
            (attachments.length ? `[${attachments.length} attachment(s)]` : '');

          verbose('Constructed emailText:', emailText);
          this.slog('info', 'Recieved email', {
            from: parsed.from?.text,
            subject: parsed.subject,
            attachmentsNumber: attachments.length,
          })

          const fromAddress = parsed.from?.value?.[0]?.address || null
          const fromName = parsed.from?.value?.[0]?.name || null
          const toAddresses = (parsed.to?.value || []).map(item => item.address)
          const envelope = makeInboundEnvelope({
            channel: 'email',
            externalMessageId: parsed.messageId || `imap:${uid}`,
            conversationId: parsed.inReplyTo || parsed.messageId || `imap:${uid}`,
            from: fromAddress,
            fromName,
            to: toAddresses,
            timestamp: parsed.date?.toISOString(),
            text: parsed.text || '',
            extra: {
              subject: parsed.subject || '',
              replyTo: (parsed.replyTo?.value || []).map(item => item.address),
              inReplyTo: parsed.inReplyTo || null,
              references: parsed.references || [],
            },
          })
          await enqueueEnvelopeForXmpp(this.inboundQueue, {
            envelope,
            humanText: emailText,
            attachments,
          })
          for (const attachment of attachments) {
            if (attachment.path) {
              fs.rmSync(attachment.path, { force: true })
            }
          }
          log(`📤 Queued email UID ${uid} for XMPP.`);

          // ✅ Mark as seen
          await this.mailClient.messageFlagsAdd(uid, ['\\Seen']);
          verbose(`✅ Email UID ${uid} marked as seen.`);
        }
      } finally {
        lock.release();
        verbose('checkInbox lock released');
      }
    } catch (err) {
      error('Error checking inbox:', err);
    } finally {
      this.checkingInbox = false
    }
  }

  async stop() {
    super.stop()
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.outbox?.stop()
    this.inboundQueue?.stop()
    if (this.mailClient) await this.mailClient.logout().catch(() => {})
    if (this.xmppAgent) await this.xmppAgent.stop().catch(() => {})
    verbose('EmailBridge stopped')
    this.slog('debug', 'Bridge stopped')
  }
}
