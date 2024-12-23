import { createTransport } from 'nodemailer'
import { log, Verbose } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:mailer'); verbose('')

export const transporter = createTransport({
  host: conf.smtp.host,
  port: conf.smtp.port,
  secure: conf.smtp.secure,
  auth: {
    user: conf.smtp.user,
    pass: conf.smtp.pass,
  },
})
// verbose('Mail transporter created:', transporter)
