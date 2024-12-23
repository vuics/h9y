import { Router } from 'express'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:routes/test'); verbose('')
const router = Router()

router.get('/public', (req, res) => {
  res.json({
    result: 'ok'
  })
})

router.get('/private', checkAuth, (req, res) => {
  res.json({
    result: 'ok'
  })
})

router.get('/protected', checkAPIAuth, (req, res) => {
  res.json({
    result: 'ok'
  })
})

export default router
