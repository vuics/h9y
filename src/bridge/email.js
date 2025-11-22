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



// TODO: Implement email file attachments
//       The following file_manager.js code was translated from file_manager.py

// // file_manager.js
// import path from 'path';
// import axios from 'axios';
// import FileType from 'file-type';
// import { URL } from 'url';
// import https from 'https';

// const SSL_VERIFY = process.env.SSL_VERIFY !== 'false';
// const SHARE_URL_PREFIX = process.env.SHARE_URL_PREFIX || "https://selfdev-prosody.dev.local:5281/file_share/";

// export class FileManager {
//   constructor() {
//     this.fileUrls = [];
//   }

//   isSharedFileUrl(prompt) {
//     try {
//       return prompt.startsWith(SHARE_URL_PREFIX);
//     } catch (err) {
//       console.error(`Error checking prompt ${prompt}:`, err);
//       return false;
//     }
//   }

//   addFileUrl(url) {
//     try {
//       this.fileUrls.push(url);
//       return "";
//     } catch (err) {
//       console.error(`Error adding file URL ${url}:`, err);
//       return "";
//     }
//   }

//   getFileUrls() {
//     return this.fileUrls;
//   }

//   async fetchBytesFromUrl(url) {
//     try {
//       console.debug(`Downloading file from ${url}`);
//       const response = await axios.get(url, {
//         responseType: 'arraybuffer',
//         httpsAgent: SSL_VERIFY ? undefined : new https.Agent({ rejectUnauthorized: false })
//       });
//       return Buffer.from(response.data);
//     } catch (err) {
//       console.error(`Error downloading file from ${url}:`, err);
//     }
//   }

//   async getFilesBytes() {
//     return await Promise.all(this.fileUrls.map(url => this.fetchBytesFromUrl(url)));
//   }

//   getFilenameFromUrl(url) {
//     const parsedUrl = new URL(url);
//     return path.basename(parsedUrl.pathname);
//   }

//   async getTypeFromBuffer(fileBuffer) {
//     try {
//       const typeInfo = await FileType.fromBuffer(fileBuffer);
//       if (!typeInfo) return ['application/octet-stream', 'file'];
//       const [typePart] = typeInfo.mime.split('/');
//       return [typeInfo.mime, typePart];
//     } catch (err) {
//       console.error("Error getting file type from buffer:", err);
//       return ['application/octet-stream', 'file'];
//     }
//   }

//   async getFileInfoFromBuffer(fileBuffer) {
//     const [mimeType, typePart] = await this.getTypeFromBuffer(fileBuffer);
//     const type = ['image', 'audio', 'text'].includes(typePart) ? typePart : 'file';

//     if (type === 'text') {
//       return {
//         type,
//         mimeType,
//         text: fileBuffer.toString('utf-8')
//       };
//     } else {
//       const dataBase64 = fileBuffer.toString('base64');
//       return {
//         type,
//         sourceType: 'base64',
//         data: dataBase64,
//         mimeType
//       };
//     }
//   }

//   async getFilesInfo() {
//     const filesBytes = await this.getFilesBytes();
//     return await Promise.all(filesBytes.map(buf => this.getFileInfoFromBuffer(buf)));
//   }

//   clear() {
//     this.fileUrls = [];
//   }

//   /**
//    * Uploads all stored files using the agent's uploadFile() method.
//    * @param {XmppAgent} agent - The XMPP agent instance that implements uploadFile()
//    * @param {string} shareHost - The XMPP upload share host JID
//    * @returns {Promise<string[]>} - Array of uploaded file URLs
//    */
//   async uploadFiles(agent, shareHost) {
//     try {
//       const results = [];

//       const fileUrls = this.getFileUrls();
//       const files = await this.getFilesBytes();

//       for (let i = 0; i < files.length; i++) {
//         const buffer = files[i];
//         const filename = this.getFilenameFromUrl(fileUrls[i]);
//         const [mimeType] = await this.getTypeFromBuffer(buffer);
//         const size = buffer.length;

//         console.log(`⬆️ Uploading ${filename} (${mimeType}, ${size} bytes)...`);
//         const getUrl = await agent.uploadFile({
//           buffer,
//           filename,
//           size,
//           contentType: mimeType,
//           shareHost,
//         });

//         results.push(getUrl);
//       }

//       // Clear after upload
//       this.clear();
//       return results;
//     } catch (err) {
//       console.error('Error uploading files via FileManager:', err);
//       throw err;
//     }
//   }
// }





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
        pass: opts.imap.password,
      },
    }
    verbose('imapOptions:', imapOptions)
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
    verbose('smtpOptions:', smtpOptions)
    this.smtpTransporter = nodemailer.createTransport({
      host: opts.smtp.host,
      port: opts.smtp.port || 465,
      secure: opts.smtp.secure !== false,
      auth: {
        user: opts.smtp.user,
        pass: opts.smtp.password,
      },
    })
    verbose('smtpTransporter:', this.smtpTransporter)
    log('SMTP ready:', opts.smtp.host)
    this.slog('info', 'SMPT client connected', {
      host: opts.smtp.host,
    })

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
        this.slog('debug', 'Email sent', {
          to: mailOptions.to
        })
      } catch (err) {
        error('Failed to send email from XMPP message:', err)
      }
    }
    this.slog('debug', 'Bridge started')
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
            (attachments.length ? `[+${attachments.length} attachments saved]` : '');

          verbose('Constructed emailText:', emailText);
          this.slog('info', 'Recieved email', {
            from: parsed.from?.text,
            subject: parsed.subject,
            attachmentsNumber: attachments.length,
          })

          // FIXME:
          // const xmppAttachments = await this._convertAttachmentsToXmpp(attachments)

          if (this.bridge.options.enablePersonal) {
            await this.xmppAgent.xmppClient.sendPersonalMessage({
              recipient: this.bridge.options.recipient,
              prompt: emailText,

              // FIXME:
              // attachments: xmppAttachments.length ? xmppAttachments : undefined,
            });
            log(`📤 Sent email UID ${uid} to XMPP recipient ${this.bridge.options.recipient}.`);
          }
          if (this.bridge.options.enableRoom && this.bridge.options.joinRooms?.length > 0) {
            await this.xmppAgent.xmppClient.sendRoomMessage({
              room: this.bridge.options.joinRooms[0],
              recipient: this.bridge.options.recipientNickname,
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
    this.slog('debug', 'Bridge stopped')
  }
}
