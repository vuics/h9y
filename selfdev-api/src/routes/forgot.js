import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { randomBytes } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
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

  if (!validateEmail(email)) {
    return res.status(400).json({
      result: 'error',
      message: 'Invalid email address. ',
    })
  }

  // NOTE: Whether the address is registered is not something this route should
  //       answer. Every outcome below that is not a server fault returns the
  //       same body, so asking here says nothing that asking the signup form
  //       would not already refuse to say.
  const sentMessage = {
    result: 'ok',
    message: 'If the address is registered, a message with a reset link has been sent.',
  }

  let user = null
  try {
    user = await User.findOne({ email: email }).exec()
    // verbose('user:', user)
    if (!user) {
      warn('Password reset requested for an address that is not registered')
      return res.json(sentMessage)
    }

    token = randomBytes(32).toString('hex')
    if (!token) {
      throw new Error('Error generating token')
    }

    user.resetPassword.token = token
    user.resetPassword.createdAt = Date.now()
    await user.save()
  } catch (err) {
    error('Forgot password error:', err)
    return res.status(500).json({
      result: 'error',
      message: 'Could not send the message. Please, try again later.',
    })
  }

  try {
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
    log('Mail sent:', mail.messageId, 'to reset the password of:', user.email)
  } catch (err) {
    // NOTE: The error carries the mail host, its address and the provider's
    //       reply, and the client renders whatever comes back in `message`.
    //       It belongs in the log, not in the browser of whoever asked.
    error('Error sending the password reset mail:', err)

    // The letter never went out, so the token in it reached nobody. Leaving it
    // behind would keep a reset pending that no one can complete.
    try {
      user.set('resetPassword.token', undefined)
      user.set('resetPassword.createdAt', undefined)
      await user.save()
    } catch (clearErr) {
      error('Error clearing the unused reset token:', clearErr)
    }

    return res.status(500).json({
      result: 'error',
      message: 'Could not send the message. Please, try again later.',
    })
  }

  return res.json(sentMessage)
})

export default router
