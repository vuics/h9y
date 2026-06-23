import { Router } from 'express'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'
import User from '../models/user.js'

const verbose = Verbose('sd:routes/settings'); verbose('')
const router = Router()

router.get('/', checkAuth, async (req, res) => {
  try {
    verbose('get settings:', req.user.settings)
    res.json(req.user.settings)
  } catch (err) {
    res.status(400).json({ result: 'error', message: err.toString()})
  }
})

router.post('/', checkAuth, async (req, res) => {
  try {
    verbose('post settings req.body:', req.body)
    req.user.settings = {
      ...req.user.settings,
      ...req.body,
    }
    req.user.markModified('settings')
    await req.user.save()
    verbose('settings:', req.user.settings)
    res.json(req.user.settings)
  } catch (err) {
    res.status(400).json({ result: 'error', message: err.toString()})
  }
})

export default router
