import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { randomBytes } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
import User from '../models/user.js'
import { validateEmail } from '../utils/validation.js'
import conf from '../conf.js'
import { transporter } from '../mailer.js'

const verbose = Verbose('sd:routes/reset'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('reset req.body:', req.body)
  const { token, password } = req.body

  let validationError = ''
  if (token.length < 32) {
    validationError += 'Incorrect token. '
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
    delete user.resetPassword
    // verbose('Save user:', user)
    const saved = await user.save()
    log('User password reset for:', user.email)
  } catch (err) {
    error('Reset password error:', err)
    return res.status(500).json({
      result: 'error',
      message: err,
    })
  }

  return res.json({
    result: 'ok',
    email: user.email,
  })
})

export default router
