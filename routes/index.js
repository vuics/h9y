import { Router } from 'express'
import { Verbose } from '../services.js'
import oauth2 from './oauth2.js'
import login from './login.js'
import logout from './logout.js'
import signup from './signup.js'
import forgot from './forgot.js'
import reset from './reset.js'
import test from './test.js'
import ask from './ask.js'
import run from './run.js'
import available from './available.js'
import subscriptions from './subscriptions.js'

const verbose = Verbose('sd:routes/index'); verbose('')

const router = Router()
router.use('/v1/oauth2', oauth2)
router.use('/v1/login', login)
router.use('/v1/logout', logout)
router.use('/v1/signup', signup)
router.use('/v1/forgot', forgot)
router.use('/v1/reset', reset)
router.use('/v1/test', test)
router.use('/v1/ask', ask)
router.use('/v1/run', run)
router.use('/v1/available', available)
router.use('/v1/subscriptions', subscriptions)

export default router
