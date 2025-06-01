import { Router } from 'express'
// import { randomBytes } from 'crypto';
// import axios from 'axios'
// import { v4 as uuidv4 } from 'uuid'
// import generator from 'generate-password'
import NodeVault from 'node-vault'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/vault'); verbose('')
const router = Router()


let vault = null
if (conf.vault.enable) {
  const options = {
    apiVersion: 'v1', // default
    endpoint: conf.vault.addr,
    token: conf.vault.token,
  };
  console.log("vault options:", options)

  vault = NodeVault(options);
  console.log("vault:", vault)

  // TODO: Add unsealing
}


const index = async (req, res, next) => {
  try {
    if (!vault) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const result = await vault.read(`secret/data/user_${userId}`);
    const data = result.data.data; // KV v2 nests data under data.data
    verbose('data:', data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

router.get('/', checkAuth, index)
// router.get('/api', checkAPIAuth, index)

export default router
