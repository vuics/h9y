import { Router } from 'express'
import axios from 'axios'
import { inspect } from 'util'
// import { randomUUID } from 'crypto'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'
import User from '../models/user.js'
import firefly from '../firefly.js'

const verbose = Verbose('sd:routes/firefly'); verbose('')
const router = Router()

// // Example usage:
//
// const rawResponse = `
// Registration successfull
// Command: firefly accounts create selfdev-ethereum
//
// Command output:
// {
//   "address": "0xa94309d7c6406d2da079930460e69a6c05c2ec73",
//   "privateKey": "bb309005372790f5977f59a82b16f468367ff72a923211e5cb3c58c836142e9c",
//   "ptmPublicKey": ""
// }
// `;
// console.log(parseCommanderResponse(rawResponse));
//
// Output:
// {
//   message: "Registration successfull",
//   command: "firefly accounts create selfdev-ethereum",
//   commandOutput: {
//     address: "0xa94309d7c6406d2da079930460e69a6c05c2ec73",
//     privateKey: "bb309005372790f5977f59a82b16f468367ff72a923211e5cb3c58c836142e9c",
//     ptmPublicKey: ""
//   }
// }
function parseCommanderResponse(raw) {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);

  const result = {
    // status: null,
    // headers: {},
    message: null,
    command: null,
    commandOutput: null,
  };

  let jsonStart = false;
  let jsonText = '';

  for (const line of lines) {
    if (line.startsWith('Registration')) {
      result.message = line;
    } else if (line.startsWith('Command:')) {
      result.command = line.replace(/^Command:\s*/, '');
    } else if (line.startsWith('Command output:')) {
      jsonStart = true;
    } else if (jsonStart) {
      jsonText += line + '\n';
    }
  }

  try {
    result.commandOutput = JSON.parse(jsonText);
  } catch {
    result.commandOutput = null;
  }

  return result;
}

router.get('/account', checkAuth, async (req, res, next) => {
  try {
    if (req.user?.firefly?.address) {
      verbose('Using existing Firefly account address:', req.user.firefly.address);
    } else {
      log('Register a new Firefly account for user _id:', req.user._id, ', email:', req.user.email)

      try {
        const response = await axios({
          method: 'get',
          url: `${conf.firefly.commanderUrl}/register-account`,
          // headers: { 'Content-Type': 'application/json' }
        });
        verbose('Firefly Registration Status Code:', response.status);
        verbose('Firefly Registration Data:', response.data);
        const parsedResponse = parseCommanderResponse(response.data)
        verbose('parsedResponse:', parsedResponse)
        if (!req.user.firefly) {
          req.user.firefly = {};
        }
        req.user.firefly.address = parsedResponse?.commandOutput
        verbose('address:', req.user.firefly.address)
        await req.user.save();
        // verbose('Saved new XMPP credentials to user document:', req.user);
      } catch (err) {
        verbose('Firefly registration error:', err.message);
        if (err.response) {
          verbose('Firefly Error Status:', err.response.status);
          verbose('Firefly Error Data:', err.response.data);
        } else if (err.request) {
          verbose('Firefly Error: No response received');
        }
        throw new Error('Failed to register Firefly account: ' + err.message);
      }
    }

    if (req.user?.firefly?.identityId) {
      verbose('Using existing Firefly identityId:', req.user.firefly.identityId);
    } else {
      log('Register a new Firefly identity for user _id:', req.user._id, ', email:', req.user.email)

      try {
        const status = await firefly.getStatus();
        console.log('Firefly status:', inspect(status, { depth: null, colors: true }));

        const identity = await firefly.createIdentity({
          name: `user_${req.user._id}`,
          key: req.user.firefly.address,
          parent: status.org.id,
        })
        console.log('identity:', identity)
        req.user.firefly.identityId = identity.id;
        console.log('identityId:', req.user.firefly.identityId)
        await req.user.save();
      } catch (err) {
        throw new Error('Failed to register Firefly identity: ' + err.message);
      }
    }

    let balances = []
    try {
      balances = await firefly.getTokenBalances({
        key: req.user.firefly.address,
      })
      console.log('balances:', balances)
    } catch (err) {
      throw new Error('Failed to get account balances: ' + err.message);
    }

    let pools = []
    try {
      pools = await firefly.getTokenPools()
      console.log('pools:', pools)
    } catch (err) {
      throw new Error('Failed to get account balances: ' + err.message);
    }

    const out = {
      result: 'ok',
      address: req.user.firefly.address,
      identityId: req.user.firefly.identityId,
      balances,
      pools,
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    error('firefly account error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

router.post('/transfer', checkAuth, async (req, res, next) => {
  try {
    if (!req.user?.firefly?.address || !req.user?.firefly?.identityId) {
      throw new Error('Used does not have registered firefly identity')
    }
    verbose('transfer body:', req.body)
    const { pool, to, tokenIndex, amount } = req.body

    const approved = await firefly.approveTokens({
      pool,
      key: req.user.firefly.address,
      operator: to,
      config: {
        allowance: amount, // If 0 or not set, the approval is valid for any number.
      },
      approved: true,  // Setting to false can revoke an existing approval.
    })
    verbose('approved:', approved)

    const transferred = await firefly.transferTokens({
      pool,
      to,
      tokenIndex,
      amount,
      key: req.user.firefly.address,
    });
    verbose('transferred:', transferred)
    const out = {
      result: 'ok',
      transferred,
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    error('firefly transfer error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

export default router
