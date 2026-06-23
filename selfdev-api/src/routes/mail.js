import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { log, warn, Verbose } from '../services.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'
import Mailed from '../models/mailed.js'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'

const verbose = Verbose('sd:routes/mail'); verbose('')
const router = Router()

const mail = async (req, res, next) => {
  verbose('Mail req.body:', req.body)
  try {
    const { to, from, subject, text } = req.body

    if (!to) {
      to = user.email
      warn('The field "to" is omitted, substitute with default:', to)
    }
    if (!from) {
      from = conf.smtp.from
      warn('The field "from" is omitted, substitute with default:', from)
    }

    let validationError = ''
    if (to && !validateEmail(to)) {
      validationError += 'Invalid email to address. '
    }
    if (from && !validateEmail(from)) {
      validationError += 'Invalid email from address. '
    }

    if (validationError) {
      return res.status(400).json({
        result: 'error',
        message: validationError,
      })
    }

    log('Sending a mail to:', to, ', from:', from)
    const mail = await transporter.sendMail({
      from,
      to,
      subject,
      text,
    })
    log('Mail sent:', mail)

    const mailed = new Mailed({ userId: req.user._id, from, to, subject, text })
    await mailed.save()
    res.json({
      result: 'ok',
    })
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

router.post('/', checkAuth, mail)
router.post('/api', checkAPIAuth, mail)

export default router
