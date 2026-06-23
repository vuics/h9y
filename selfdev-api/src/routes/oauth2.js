import { Router } from 'express'

import { Verbose } from '../services.js'
import oauth2 from '../middleware/oauth2.js'

const verbose = Verbose('sd:routes/oauth2'); verbose('')
const router = Router()

router.post('/token', oauth2.token)

export default router
