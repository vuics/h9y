import { Router } from 'express'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/xmpp'); verbose('')
const router = Router()

const credentials = async (req, res, next) => {
  try {
    let user = null
    let password = null

    if (req.user?.xmpp?.user && req.user?.xmpp?.password) {
      user = req.user.xmpp.user;
      password = req.user.xmpp.password;
      verbose('Using existing XMPP credentials> user:', user, ', password:', password);
    } else {
      // FIXME: The problem of uniqueness. What if this user is not unique?
      //        It registers the same user with a new password that is not accessible
      //        by an old user.
      //        Possible solutions: check if that user already exists in Prosody or in Mongo (User.find())
      //        Or allow users to select a unique nickname.
      user = req.user.firstName + req.user.lastName
      password = uuidv4()
      verbose('Register a new XMPP user with credentials> user:', user, ', password:', password)

      try {
        const response = await axios({
          method: 'get',
          url: `http://${conf.xmpp.host}:8387/register`,
          params: {
            user: user,
            password: password,
            host: conf.xmpp.host
          },
          headers: { 'Content-Type': 'application/json' }
        });
        verbose('XMPP Registration Status Code:', response.status);
        verbose('XMPP Registration Data:', response.data);

        if (!req.user.xmpp) {
          req.user.xmpp = {};
        }
        req.user.xmpp.user = user;
        req.user.xmpp.password = password;
        await req.user.save();
        // verbose('Saved new XMPP credentials to user document:', req.user);
      } catch (err) {
        verbose('XMPP registration error:', err.message);
        if (err.response) {
          verbose('XMPP Error Status:', err.response.status);
          verbose('XMPP Error Data:', err.response.data);
        } else if (err.request) {
          verbose('XMPP Error: No response received');
        }
        throw new Error('Failed to register XMPP user: ' + err.message);
      }
    }
    const out = {
      result: 'ok',
      jid: `${user}@${conf.xmpp.host}`,
      password: password,
      user: user
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

router.post('/credentials', checkAuth, credentials)
// router.post('/api', checkAPIAuth, ask)

export default router
