import { createTransport } from 'nodemailer'
import { log, Verbose } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:mailer'); verbose('')

export const transporter = createTransport({
  host: conf.smtp.host,
  port: conf.smtp.port,
  secure: conf.smtp.secure,
  // service: conf.smtp.service,
  auth: {
    user: conf.smtp.user,
    pass: conf.smtp.pass,
  },
  tls: {
    // ignoreTLS: conf.smtp.ignoreTLS,
    // requireTLS: conf.smtp.requireTLS,

    // Forces Nodemailer to accept the TLS connection structure Apple uses
    // rejectUnauthorized: false,
    // ciphers: 'SSLv3'
  },

  // family: 4, // CRITICAL: Forces Node to use IPv4 instead of stalling on IPv6
  // connectionTimeout: 30000, // Increased timeout window
  // greetingTimeout: 30000,
  // logger: true,  // Enables internal Nodemailer logging
  // debug: true,   // Prints the raw SMTP communication logs
})
// verbose('Mail transporter created:', transporter)
