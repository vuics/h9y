import { Router } from 'express'
import axios from 'axios'
import { inspect } from 'util'

import { checkAuth, checkAPIAuth, checkAdmin } from '../middleware/check-auth.js'
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
// verbose(parseCommanderResponse(rawResponse));
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

export const checkFirefly = (req, res, next) => {
  if (conf.firefly.enable) {
    next()
  } else {
    res.status(403).json({
      result: 'error',
      message: 'The Firefly integration is disabled'
    })
  }
}

router.get('/admin-init', checkAuth, checkAdmin, checkFirefly, async (req, res) => {
  try {
    const pools = await firefly.getTokenPools()

    const createdPools = []
    for (const poolData of conf.firefly.pools) {
      verbose('poolData:', poolData)
      try {
        const foundPool = pools?.find(p => p.symbol === poolData.symbol)
        if (foundPool) {
          warn('The pool already exists:', poolData.symbol)
          continue
        }
        createdPools.push(await firefly.createTokenPool(poolData, { publish: true }))
      } catch (err) {
        error('Error creating pool:', poolData, ', error:', err)
      }
    }
    res.send({
      pools,
      createdPools,
    });
  } catch (err) {
    error('Error initializing firefly:', err)
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

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
        req.user.firefly.address = parsedResponse?.commandOutput?.address
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
        verbose('Firefly status:', inspect(status, { depth: null, colors: true }));

        const identity = await firefly.createIdentity({
          name: `user_${req.user._id}`,
          key: req.user.firefly.address,
          parent: status.org.id,
        })
        verbose('identity:', identity)
        req.user.firefly.identityId = identity.id;
        verbose('identityId:', req.user.firefly.identityId)
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
      verbose('balances:', balances)
    } catch (err) {
      throw new Error('Failed to get account balances: ' + err.message);
    }

    let pools = []
    try {
      pools = await firefly.getTokenPools()
      verbose('pools:', pools)
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

router.get('/transfer', checkAuth, async (req, res, next) => {
  try {
    if (!req.user?.firefly?.address || !req.user?.firefly?.identityId) {
      throw new Error('Used does not have registered firefly identity')
    }
    verbose('transfer body:', req.body)
    const { fromOrTo } = req.body
    const transfers = await firefly.getTokenTransfers({
      fromOrTo: req.user.firefly.address,
    });
    verbose('transfers:', transfers)
    res.json(transfers)
  } catch (err) {
    error('firefly listing transfers error:', err)
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
    const transferred = await firefly.transferTokens({
      pool,
      to,
      from: req.user.firefly.address,
      key: req.user.firefly.address, // from and key are the same, no need the approval
      tokenIndex,
      amount,
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

router.post('/collect', checkAuth, async (req, res, next) => {
  try {
    if (!req.user?.firefly?.address || !req.user?.firefly?.identityId) {
      throw new Error('Used does not have registered firefly identity')
    }
    verbose('collect body:', req.body)
    const { pool, from, tokenIndex, amount } = req.body

    const collected = await firefly.transferTokens({
      pool,
      to: req.user.firefly.address,
      from,
      key: req.user.firefly.address, // from and key are different, need an approval
      tokenIndex,
      amount,
    });
    verbose('collected:', collected)
    const out = {
      result: 'ok',
      collected,
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    error('firefly collect error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

router.get('/approvals', checkAuth, async (req, res, next) => {
  try {
    if (!req.user?.firefly?.address || !req.user?.firefly?.identityId) {
      throw new Error('Used does not have registered firefly identity')
    }
    const approvals = await firefly.getTokenApprovals({
      key: req.user.firefly.address,
    })
    // verbose('approvals:', approvals)

    const out = {
      result: 'ok',
      approvals,
    }
    // verbose('out:', out)
    res.json(out)
  } catch (err) {
    error('firefly getting approvals error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

router.post('/approvals', checkAuth, async (req, res, next) => {
  try {
    if (!req.user?.firefly?.address || !req.user?.firefly?.identityId) {
      throw new Error('Used does not have registered firefly identity')
    }
    verbose('POST approvals body:', req.body)
    const { operator, pool, from, allowance, approved } = req.body

    const approval = await firefly.approveTokens({
      pool,
      key: req.user.firefly.address,
      operator,
      config: {
        allowance, // If not set, the approval is valid for any number.
      },
      approved,  // Setting to false can revoke an existing approval.
    })
    verbose('approval:', approval)

    const out = {
      result: 'ok',
      approval,
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    error('firefly posting approvals error:', err)
    res.status(500).json({ result: 'error', message: err.toString()})
  }
})

export default router
