import { Router } from 'express'
import lodash from 'lodash'
const { isEmpty } = lodash
import { log, warn, Verbose } from '../services.js'
import { validateEmail, validatePhone, validatePassword } from '../utils/validation.js'
import { transporter } from '../mailer.js'
import conf from '../conf.js'
import Landing from '../models/landing.js'
import Interest from '../models/interest.js'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'

const verbose = Verbose('sd:routes/land'); verbose('')
const router = Router()

const interest = async (req, res, next) => {
  // verbose('Interest req.body:', req.body, ', req.params:', req.params)
  try {
    const { landingId } = req.body
    // verbose('landingId:', landingId)
    const landing = await Landing.findById(landingId).exec()
    // verbose('landing:', landing)
    if (landing) {
      // verbose('userId:', landing.userId.toString(), ', :', req.user._id.toString())
      if (landing.userId.toString() !== req.user._id.toString()) {
        throw new Error('Landing page user id does not match with the authenticated user id')
      }
    } else {
        throw new Error('Landing page is not found')
    }

    const interest = await Interest.find({ landingId }).exec()
    // verbose('interest:', interest)
    if (interest && interest.length > 0) {
    }
    res.json({
      result: 'ok',
      interest,
    })
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

// router.post('/', checkAuth, land)
router.post('/api/', checkAPIAuth, interest)

export default router
