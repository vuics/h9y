import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { log, warn, Verbose } from '../services.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'
import Landing from '../models/landing.js'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'

const verbose = Verbose('sd:routes/land'); verbose('')
const router = Router()

const land = async (req, res, next) => {
  // verbose('Land req.body:', req.body)
  try {
    const { body, title, favicon, interestForm } = req.body
    const landing = new Landing({
      userId: req.user._id,
      body, title, favicon, interestForm
    })
    // verbose('landing:', landing)
    await landing.save()
    res.json({
      result: 'ok',
      landingId: landing._id,
    })
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

// router.post('/', checkAuth, land)
router.post('/api', checkAPIAuth, land)

export default router
