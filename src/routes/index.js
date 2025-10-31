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
import mail from './mail.js'
import land from './land.js'
import interest from './interest.js'
import available from './available.js'
import subscriptions from './subscriptions.js'
import autopayments from './autopayments.js'
import xmpp from './xmpp.js'
import vault from './vault.js'
import profile from './profile.js'
import settings from './settings.js'
import executor from './executor.js'
import firefly from './firefly.js'
import apps from './apps.js'
import dashboard from './dashboard.js'

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
router.use('/v1/mail', mail)
router.use('/v1/land', land)
router.use('/v1/interest', interest)
router.use('/v1/available', available)
router.use('/v1/subscriptions', subscriptions)
router.use('/v1/autopayments', autopayments)
router.use('/v1/xmpp', xmpp)
router.use('/v1/vault', vault)
router.use('/v1/profile', profile)
router.use('/v1/settings', settings)
router.use('/v1/executor', executor)
router.use('/v1/firefly', firefly)
router.use('/v1/apps', apps)
router.use('/v1/dashboard', dashboard)

export default router
