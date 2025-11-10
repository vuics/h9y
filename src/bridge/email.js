import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import fs from 'fs'
import path from 'path'
import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/email')
verbose('')

export default class Email extends Connector {
  constructor(args) {
    super(args)
    verbose('EmailBridge constructed')

    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.email.joinRoom],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.email.enablePersonal,
      handleRooms: this.bridge.options.email.enableRoom,
    })

    this.mailClient = null
    this.smtpTransporter = null
    this.pollInterval = null
    this.attachmentsDir = path.resolve('./email_attachments')

    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true })
    }
  }

  async ensureConnected(client) {
    if (!client.connected) {
      console.log('Reconnecting IMAP...')
      await client.connect()
    } else if (!client.authenticated) {
      console.log('Not authenticated, reconnecting...')
      await client.logout().catch(() => {})
      await client.connect()
    }
  }

  async connectImap(client, maxRetries = 5) {
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        await client.connect()
        log('✅ IMAP connected')
        return
      } catch (err) {
        attempt++
        warn(`IMAP connection failed (attempt ${attempt}/${maxRetries}):`, err.code)
        await new Promise(res => setTimeout(res, 5000 * attempt))
      }
    }
    error('❌ IMAP connection failed after max retries')
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
        pass: opts.imap.pass,
      },
    }
    verbose(imapOptions)
    this.mailClient = new ImapFlow(imapOptions)
    // verbose('mailClient:', this.mailClient)
    log('mailClient connected (before):', this.mailClient.connected) // boolean
    log('mailClient authenticated (before):', this.mailClient.authenticated) // boolean

    await this.mailClient.connect()
    // await connectImap(this.mailClient)
    // await ensureConnected(this.mailClient)

    log('IMAP connected:', opts.imap.host)
    log('mailClient connected (after):', this.mailClient.connected) // boolean
    log('mailClient authenticated (after):', this.mailClient.authenticated) // boolean

    // setInterval(() => {
    //   const c = this.mailClient
    //   if (!c.connected) warn('IMAP not connected')
    //   if (!c.authenticated) warn('IMAP not authenticated')
    // }, 10_000)



    /* ---------- SMTP TRANSPORT ---------- */
    this.smtpTransporter = nodemailer.createTransport({
      host: opts.smtp.host,
      port: opts.smtp.port || 465,
      secure: opts.smtp.secure !== false,
      auth: {
        user: opts.smtp.user,
        pass: opts.smtp.pass,
      },
    })
    verbose('smtpTransporter:', this.smtpTransporter)

    log('SMTP ready:', opts.smtp.host)

    /* ---------- POLLING LOOP ---------- */
    this.pollInterval = setInterval(() => this.checkInbox(), (opts.pollSec || 30) * 1000)
    await this.xmppAgent.start()

    /* ---------- XMPP → EMAIL ---------- */
    // FIXME: attarchments arg does not pass
    this.xmppAgent.chat = async ({ prompt, attachments } = {}) => {
      try {
        verbose('XMPP message received for email send:', prompt)

        let msg = null
        try {
          msg = JSON.parse(prompt)
        } catch {
          msg = { text: prompt }
        }

        const mailOptions = {
          from: opts.smtp.user,
          to: msg.to || opts.defaultRecipient,
          subject: msg.subject || opts.defaultSubject,
          text: msg.text || '',
          attachments: [],
        }

        // Handle attachments sent via XMPP
        if (attachments && attachments.length > 0) {
          for (const a of attachments) {
            const filePath = path.join(this.attachmentsDir, a.filename)
            fs.writeFileSync(filePath, Buffer.from(a.content, 'base64'))
            mailOptions.attachments.push({
              filename: a.filename,
              path: filePath,
            })
          }
        }

        verbose('mailOptions:', mailOptions)
        await this.smtpTransporter.sendMail(mailOptions)
        log('Email sent to:', mailOptions.to)
      } catch (err) {
        error('Failed to send email from XMPP message:', err)
      }
    }
  }

  async checkInbox() {
    try {
      // Lock the INBOX while processing
      const lock = await this.mailClient.getMailboxLock('INBOX');
      verbose('checkInbox lock acquired');

      try {
        // ✅ Search for all unseen (unread) messages
        const unseenUids = await this.mailClient.search({ seen: false });
        verbose(`Found ${unseenUids.length} unseen emails.`);

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
            (attachments.length ? `[+${attachments.length} attachments saved]` : '');

          verbose('Constructed emailText:', emailText);

          // FIXME:
          // const xmppAttachments = await this._convertAttachmentsToXmpp(attachments)

          // ✅ Send personal message
          if (this.bridge.options.email.enablePersonal && this.bridge.options.email.recipient) {
            await this.xmppAgent.xmppClient.sendPersonalMessage({
              recipient: this.bridge.options.email.recipient,
              prompt: emailText,

              // FIXME:
              // attachments: xmppAttachments.length ? xmppAttachments : undefined,
            });
            log(`📤 Sent email UID ${uid} to XMPP recipient ${this.bridge.options.email.recipient}.`);
          }

          // ✅ Send to group chat (room)
          if (this.bridge.options.email.enableRoom && this.bridge.options.email.joinRoom) {
            await this.xmppAgent.xmppClient.sendRoomMessage({
              room: this.bridge.options.email.joinRoom,
              recipient: this.bridge.options.email.recipientNickname,
              mucHost: conf.xmpp.mucHost,
              prompt: emailText,

              // FIXME:
              // attachments: xmppAttachments.length ? xmppAttachments : undefined,
            });
            log(`📤 Sent email UID ${uid} to XMPP room.`);
          }


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
    }
  }

  async _convertAttachmentsToXmpp(attachments) {
    if (!attachments || attachments.length === 0) { return [] }
    const out = []
    for (const att of attachments) {
      const data = fs.readFileSync(att.path)
      out.push({
        filename: att.filename,
        contentType: att.contentType,
        content: data.toString('base64'),
      })
    }
    return out
  }

  async stop() {
    super.stop()
    if (this.pollInterval) clearInterval(this.pollInterval)
    if (this.mailClient) await this.mailClient.logout().catch(() => {})
    if (this.xmppAgent) await this.xmppAgent.stop().catch(() => {})
    verbose('EmailBridge stopped')
  }
}
