import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { randomBytes } from 'crypto'

import { log, Verbose } from '../services.js'
import User from '../models/user.js'
import { validateEmail } from '../utils/validation.js'
import conf from '../conf.js'
import { transporter } from '../mailer.js'

const verbose = Verbose('sd:routes/forgot'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('forgot req.body:', req.body)
  const { email } = req.body
  let token = null

  try {
    const user = await User.findOne({ email: email }).exec()
    // verbose('user:', user)
    if (!user) {
      return res.status(404).json({
        result: 'error',
        message: 'User not found',
      })
    }

    token = randomBytes(32).toString('hex')
    if (!token) {
      throw new Error('Error generating token')
    }

    user.resetPassword.token = token
    user.resetPassword.createdAt = Date.now()
    await user.save()

    verbose('Sending mail to reset password to:', user.email)
    const mail = await transporter.sendMail({
      from: conf.smtp.from,
      to: user.email,
      subject: 'Reset Password',
      text: `
Hi,

We just received a requested to reset your password on Self-developing AI.

Please, click the link below to reset password:
${conf.webApp.origin + '/reset?token=' + token}

This link will expire within ${conf.reset.expiresMinutes} minutes.

If you don't want to reset your password, just ignore this message and nothing will be changed.

Feel free to contact us if you have any difficulties resetting your password.

All the best,
The SelfDev Team
`
    })
    log('Mail sent:', mail)
  } catch (err) {
    return res.status(500).json({
      result: 'error',
      message: err,
    })
  }

  return res.json({
    result: 'ok',
    message: 'Email message sent. Check your inbox.'
  })
})

export default router
