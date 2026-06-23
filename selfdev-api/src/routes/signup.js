import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash

import { log, Verbose } from '../services.js'
import User from '../models/user.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'
import { updateUserLimits } from './subscriptions.js'
import { userI18n } from '../i18n.js'

const verbose = Verbose('sd:routes/signup'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('signup req.body:', req.body)
  const {
    email, password, firstName, lastName, phone, country, language,
    termsConsent, privacyConsent, marketingConsent,
  } = req.body

  let validationError = ''
  if (isEmpty(firstName)) {
    validationError += 'Invalid first name. '
  }
  if (isEmpty(lastName)) {
    validationError += 'Invalid last name. '
  }
  if (!validateEmail(email)) {
    validationError += 'Invalid email address. '
  }
  if (phone && !validatePhone(phone)) {
    validationError += 'Invalid phone. '
  }
  if (!(validatePassword(password)).valid) {
    validationError += 'Invalid password. '
  }
  if (isEmpty(country)) {
    validationError += 'Invalid country code. '
  }
  if (isEmpty(language)) {
    validationError += 'Invalid language code. '
  }
  if (validationError) {
    return res.status(400).json({
      result: 'error',
      message: validationError,
    })
  }

  try {
    const users = await User.find({ email: email }).exec()
    verbose('users:', users)
    if (users && users.length > 0) {
      return res.status(403).json({
        result: 'error',
        message: 'User already exists',
      })
    }
  } catch (err) {
    return res.status(500).json({
      result: 'error',
      message: err,
    })
  }

  const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('User IP:', ip);
  const timestamp = new Date().toISOString();
  console.log('Timestamp:', timestamp);

  let user = null
  try {
    user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      roles: ['user'],
      address: {
        country,
      },
      settings: {
        language,
        marketingConsent,
      },
      consent: {
        termsConsent,
        privacyConsent,
        ip,
        timestamp,
      },
    })
    console.log('User created:', user.email)
    await updateUserLimits({ user })
  } catch (err) {
    return res.status(500).json({
      result: 'error',
      message: err,
    })
  }

  res.json({
    result: 'ok',
    // user: user.toObject()
  })

  verbose('Sending welcome mail to:', user.email)
  const { t } = userI18n({ user })
  const subject = t('email.welcome.subject', { userName: user.firstName });
  const text = t('email.welcome.text', {
    userName: user.firstName,
    link: conf.webApp.origin,
  });
  verbose('subject:', subject)
  verbose('text:', text)

  const mail = await transporter.sendMail({
    from: conf.smtp.from,
    to: user.email,
    subject,
    text,
  })
  log('Mail sent:', mail)
})

export default router
