import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { log, Verbose } from '../services.js'
import User from '../models/user.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/signup'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('signup req.body:', req.body)
  const { email, password, firstName, lastName, phone } = req.body

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

  let user = null
  try {
    user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      roles: ['user']
    })
    // console.log('User created:', user.toObject())
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
  const mail = await transporter.sendMail({
    from: conf.smtp.from,
    to: user.email,
    subject: 'Welcome to AZ1!',
    text: `
Hi ${user.firstName},

Welcome to Self-developing AI platform!

We are excited to have you on board. The Self-developing AI is designed for automating everything.

With Self-developing AI, you can:
- Get answers on any questions about self-developing AI.
- Program self-developing AI in plain language.
- Run virtual agents.
- And much more.

To get started, please check out the web app:
${conf.webApp.origin}

Feel free to contact us if you have any questions. Please, tell us how to develop our app to satisfy your needs. We hope you enjoy the Self-developing AI.

All the best,
The AZ1 Team
`
  })
  log('Mail sent:', mail)
})

export default router
