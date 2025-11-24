import { randomBytes } from 'crypto';
import { Router } from 'express'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import generator from 'generate-password'
import { customAlphabet } from 'nanoid'
import { transliterate } from 'transliteration'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'
import User from '../models/user.js'
import Bridge from '../models/bridge.js'

const customNanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)

const verbose = Verbose('sd:routes/xmpp'); verbose('')
const router = Router()

const credentials = async (req, res, next) => {
  try {
    let user = null
    let password = null

    if (req.user?.xmpp?.user && req.user?.xmpp?.password) {
      user = req.user.xmpp.user;
      password = req.user.xmpp.password;
      // verbose('Using existing XMPP credentials> user:', user, ', password:', password);
      verbose('Using existing XMPP credentials for user:', user);
    } else {
      // NOTE: The code below solves the problem of user name uniqueness.
      const baseUser = transliterate(req.user.firstName + req.user.lastName).toLowerCase();
      user = baseUser;
      for (let i = 0; i < 32; i++) {
        const existingUser = await User.findOne({ 'xmpp.user': user });
        if (!existingUser) {
          verbose('xmpp.user is unique, safe to use:', user);
          break;
        } else {
          verbose('xmpp.user already exists:', user);
          user = (`${baseUser}-${customNanoid(i + 1)}`).toLowerCase();
        }
      }

      password = generator.generate({
        length: 16,
        numbers: true,
        symbols: true,
        uppercase: true,
        strict: true,
      })
      verbose('Register a new XMPP user:', user)
      // verbose('Register a new XMPP user with credentials> user:', user, ', password:', password)

      try {
        const response = await axios({
          method: 'get',
          url: `${conf.xmpp.commanderUrl}/register-user`,
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
    // verbose('out:', out)
    res.json(out)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

router.post('/credentials', checkAuth, credentials)
// router.post('/api', checkAPIAuth, ask)


router.post('/client/:bridgeId', checkAuth, async (req, res, next) => {
  try {
    const { bridgeId } = req.params
    verbose('xmpp client bridgeId:', bridgeId)
    const bridge = await Bridge.findById(bridgeId)
    if (!bridge) {
      throw new Error("Client bridge not found")
    }
    verbose('bridge:', bridge)

    if (!bridge.options.client) {
      bridge.options.client = {}
    }
    if (!bridge.options.client.user) {
      bridge.options.client.user = bridge.options.name
    }
    if (!bridge.options.client.password) {
      bridge.options.client.password = generator.generate({
        length: 32,
        numbers: true,
        symbols: true,
        uppercase: true,
        strict: true,
      })
    }
    // verbose('bridge.options.client:', bridge.options.client)
    const host = `${req.user.xmpp.user}.${conf.xmpp.host}`
    // verbose('host:', host)

    try {
      verbose('Register a new XMPP agent:', bridge.options.client.user)
      const response = await axios.get(`${conf.xmpp.commanderUrl}/register-agent`, {
        params: {
          user: bridge.options.client.user,
          password: bridge.options.client.password,
          host,
        },
        headers: { 'Content-Type': 'application/json' },
      });
      verbose(`Client bridge XMPP Registration Status Code: ${response.status}`);
      verbose(`Client bridge XMPP Registration Data: ${response.data}`);
      if (response.status >= 400) {
        throw new Error(`Error registering client bridge, status: ${response.status}`)
      }

      await bridge.save();
      verbose('Saved new client XMPP credentials to bridge doc:', bridge);

      const out = {
        result: 'ok',
        jid: `${bridge.options.client.user}@${host}`,
        password: bridge.options.client.password,
        server: conf.xmpp.host,
      }
      verbose('out:', out)
      res.json(out)
    } catch (err) {
      verbose('Client bridge XMPP registration error:', err.message);
      if (err.response) {
        verbose('Client bridge XMPP Error Status:', err.response.status);
        verbose('Client bridge XMPP Error Data:', err.response.data);
      } else if (err.request) {
        verbose('Client bridge XMPP Error: No response received');
      }
      throw new Error('Failed to register client bridge XMPP: ' + err.message);
    }
  } catch (err) {
    error('Registering client bridge error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

router.delete('/client/:bridgeId', checkAuth, async (req, res, next) => {
  try {
    const { bridgeId } = req.params
    verbose('xmpp client bridgeId:', bridgeId)
    const bridge = await Bridge.findById(bridgeId)
    if (!bridge) {
      throw new Error("Client bridge not found")
    }
    verbose('bridge:', bridge)
    if (!bridge.options.client) {
      throw new Error("The client bridge is not registered")
    }

    try {
      const jid = `${bridge.options.client.user}@${req.user.xmpp.user}.${conf.xmpp.host}`
      verbose('Unregister an client bridge from XMPP, jid:', jid)
      const response = await axios.get(`${conf.xmpp.commanderUrl}/delete-agent`, {
        params: {
          jid,
        },
        headers: { 'Content-Type': 'application/json' },
      });
      verbose(`Client bridge XMPP Unregistration Status Code: ${response.status}`);
      verbose(`Client bridge XMPP Unregistration Data: ${response.data}`);
      if (response.status >= 400) {
        throw new Error(`Error registering client bridge, status: ${response.status}`)
      }
      verbose('Unregister client bridge XMPP credentials from bridge doc:', bridge);
      const out = {
        result: 'ok',
      }
      verbose('out:', out)
      res.json(out)
    } catch (err) {
      verbose('Client bridge XMPP unregistering error:', err.message);
      if (err.response) {
        verbose('Client bridge XMPP unregistering error, status:', err.response.status);
        verbose('Client bridge XMPP unregistering error, data:', err.response.data);
      } else if (err.request) {
        verbose('Client bridge XMPP unregistering error: No response received');
      }
      throw new Error('Failed to unregister client bridge XMPP: ' + err.message);
    }
  } catch (err) {
    error('Unregistering client bridge xmpp error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

export default router
