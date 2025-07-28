import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { log, Verbose } from '../services.js'
import User from '../models/user.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'
import { updateUserLimits } from './subscriptions.js'

const verbose = Verbose('sd:routes/signup'); verbose('')
const router = Router()

const app = router
app.post('/', async (req, res, next) => {
  // verbose('signup req.body:', req.body)
  const { email, password, firstName, lastName, phone, country, language } = req.body

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
  const mail = await transporter.sendMail({
    from: conf.smtp.from,
    to: user.email,
    subject: 'Welcome to HyperAgency — Your Agentic AI Platform',

    // TODO: translate to different languages
    text: `Hi ${user.firstName},

Welcome to HyperAgency — the self-developing, agentic AI platform designed to help you automate everything, evolve faster, and focus on what truly matters.

With HyperAgency, you can:
- Build and run **agentic AI systems** that evolve your product, business, or infrastructure.
- Program agents using **plain language prompts**, no coding required.
- Deploy agents that improve themselves or automate your daily workflows.
- Connect to any APIs, UI, databases, etc.
- Take control of your stack with **autonomous orchestration**.
- Export, control, and document agent behavior human-in-the-loop supervision.

Start now:
${conf.webApp.origin}

Need help? Have ideas? Reply to this email — we’d love to hear how HyperAgency can better serve your vision.

Thank you for joining the future of self-developing systems.

Let’s build something extraordinary,
The HyperAgency Team
`
  })
  log('Mail sent:', mail)
})

export default router
