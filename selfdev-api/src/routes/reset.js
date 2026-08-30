import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { randomBytes } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
import User from '../models/user.js'
import { validatePassword, validateResetToken } from '../utils/validation.js'
import conf from '../conf.js'
import { transporter } from '../mailer.js'
import { destroyUserSessions } from '../middleware/session.js'

const verbose = Verbose('sd:routes/reset'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('reset req.body:', req.body)
  const { token, password } = req.body

  let validationError = ''
  if (!validateResetToken(token)) {
    validationError += 'Incorrect token. '
  }
  if (!(validatePassword(password)).valid) {
    validationError += 'Invalid password. '
  }
  if (validationError) {
    return res.status(400).json({
      result: 'error',
      message: validationError,
    })
  }

  let user = null
  try {
    user = await User.findOne({ 'resetPassword.token': token }).exec()
    verbose('user:', user)
    if (!user) {
      return res.status(404).json({
        result: 'error',
        message: 'Token not found',
      })
    }

    if (!user.resetPassword?.createdAt) {
      warn('Reset password token for', user.email, 'has no creation date')
      return res.status(410).json({
        result: 'error',
        message: 'Token expired',
      })
    }

    const createdAt = user.resetPassword.createdAt.valueOf()
    // log('createdAt:', createdAt)
    // log('conf.reset.expiresMinutes*60*1000:', conf.reset.expiresMinutes*60*1000)
    // log('sum:', createdAt + conf.reset.expiresMinutes*60*1000)
    // log('Date.now():', Date.now())
    // log('condition:', createdAt + conf.reset.expiresMinutes*60*1000 <= Date.now())
    if (createdAt + conf.reset.expiresMinutes*60*1000 <= Date.now()) {
      warn('Reset password token for', user.email, 'has expired')
      return res.status(410).json({
        result: 'error',
        message: 'Token expired',
      })
    }
    user.password = password
    // NOTE: `delete` only drops the getter on the document, the token stays in
    //       the database and the reset link keeps working until it expires.
    user.set('resetPassword.token', undefined)
    user.set('resetPassword.createdAt', undefined)
    // verbose('Save user:', user)
    await user.save()
    log('User password reset for:', user.email)

    // NOTE: Whoever is signed in was signed in under the old password, and one
    //       reason to reset is that somebody else has it. Sessions survive a
    //       password change on their own, so they have to be taken out here.
    //       The password is already saved; a failure to clear the sessions is
    //       worth shouting about but not worth failing the reset over.
    try {
      const destroyed = await destroyUserSessions({ userId: user._id })
      log('Signed out', destroyed, 'session(s) of:', user.email)
    } catch (err) {
      error('Error signing out the sessions of', user.email, ':', err)
    }
  } catch (err) {
    // NOTE: The client renders whatever comes back in `message`, so an error
    //       object would put internals on somebody's screen. Log it instead.
    error('Reset password error:', err)
    return res.status(500).json({
      result: 'error',
      message: 'Could not reset the password. Please, try again later.',
    })
  }

  return res.json({
    result: 'ok',
    email: user.email,
  })
})

export default router
