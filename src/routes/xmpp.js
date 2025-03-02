import { Router } from 'express'
import axios from 'axios'
import lodash from 'lodash'
const { has } = lodash
import { v4 as uuidv4 } from 'uuid'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/xmpp'); verbose('')
const router = Router()

const credentials = async (req, res, next) => {
  verbose('talkUser')
  // verbose('ask req.headers:', req.headers)
  // verbose('ask req.user:', req.user)
  // verbose('conf.xmpp.host:', conf.xmpp.host)
  try {
    let user = null
    let password = null

    // if (!has(req.user, 'xmpp.user') || !has(req.user, 'xmpp.password')) {
      // FIXME: limitation on uniqueness of the name
      // second name like this will not be registered
      // should we allow user to input a unique nickname?
      // req.user.xmpp.user = req.user.firstName + req.user.lastName
      // req.user.xmpp.password = uuidv4()
      // req.user.xmpp = {
      //   user: 'art',
      //   password: '123',
      // }
      // FIXME:
      // const response = await axios({
      //   method: 'get',
      //   url: `http://${conf.xmpp.host}:8387/register`,
      //   params: {
      //     user: req.user.xmpp.user,
      //     password: req.user.xmpp.password,
      //     host: conf.xmpp.host
      //   },
      //   headers: { 'Content-Type': 'application/json' }
      // })
      // verbose('Status Code:', response.status)
      // verbose('Headers:', response.headers)
      // verbose('Data:', response.data)
    // }
    // const dialog = new Dialog({ userId: req.user._id, prompt, reply })
    const out = {
      result: 'ok',
      // jid: `${req.user.xmpp.user}@${conf.xmpp.host}`,
      // password: req.user.xmpp.password,
      user: 'art',
      password: '123',
    }
    verbose('out:', out)
    res.json(out)
    // await req.user.save()
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

router.post('/credentials', checkAuth, credentials)
// router.post('/api', checkAPIAuth, ask)

export default router
