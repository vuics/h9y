import { Router } from 'express'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'
import User from '../models/user.js'

const verbose = Verbose('sd:routes/profile'); verbose('')
const router = Router()

router.get('/', checkAuth, async (req, res) => {
  try {
    verbose('get profile:', req.user)
    res.json({
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      phone: req.user.phone,
      address: req.user.address,
    })
  } catch (err) {
    res.status(400).json({ result: 'error', message: err.toString()})
  }
})

router.post('/', checkAuth, async (req, res) => {
  try {
    verbose('post settings req.body:', req.body)
    if (req.body.email) {
      req.user.email = req.body.email
    }
    if (req.body.firstName) {
      req.user.firstName = req.body.firstName
    }
    if (req.body.lastName) {
      req.user.lastName = req.body.lastName
    }
    if (req.body.phone) {
      req.user.phone = req.body.phone
    }

    if (!req.user.address) {
      req.user.address = {}
    }
    if (req.body.address?.line1) {
      req.user.address.line1 = req.body.address.line1
    }
    if (req.body.address?.line2) {
      req.user.address.line2 = req.body.address.line2
    }
    if (req.body.address?.city) {
      req.user.address.city = req.body.address.city
    }
    if (req.body.address?.state) {
      req.user.address.state = req.body.address.state
    }
    if (req.body.address?.postalCode) {
      req.user.address.postalCode = req.body.address.postalCode
    }
    if (req.body.address?.country) {
      req.user.address.country = req.body.address.country
    }
    await req.user.save()
    verbose('profile:', req.user)
    res.json({
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      phone: req.user.phone,
      address: req.user.address,
    })
  } catch (err) {
    res.status(400).json({ result: 'error', message: err.toString()})
  }
})

router.get('/avatar', checkAuth, async (req, res) => {
  try {
    res.json({ avatar: req.user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

router.post('/avatar', checkAuth, async (req, res) => {
  try {
    const { avatar } = req.body;
    verbose('avatar:', avatar.slice(0, 80), '...')

    // Validate the base64 image
    if (!avatar || !avatar.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    req.user.avatar = avatar
    await req.user.save()

    verbose('req.user.avatar:', req.user.avatar?.slice(0, 80), '...')
    res.json({ avatar: req.user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});

export default router
