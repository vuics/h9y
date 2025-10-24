import { Router } from 'express'
import axios from 'axios'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'
import User from '../models/user.js'

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

const account = async (req, res, next) => {
  try {
    let address = null

    if (req.user?.firefly?.address) {
      address = req.user.firefly.address;
      verbose('Using existing Firefly account address:', address);
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
        address = parsedResponse?.commandOutput?.address
        verbose('address:', address)

        if (!req.user.firefly) {
          req.user.firefly = {};
        }
        req.user.firefly.address = address;
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
    const out = {
      result: 'ok',
      address,
    }
    verbose('out:', out)
    res.json(out)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

router.get('/account', checkAuth, account)

export default router
