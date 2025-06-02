import { Router } from 'express'
import NodeVault from 'node-vault'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/vault'); verbose('')
const router = Router()

let vault = null

async function unsealVault() {
  try {
    let status = await vault.status();
    log(`Vault status (before)> sealed: ${status.sealed}`);
    if (!status.sealed) {
      return log('Vault was already unsealed!');
    }

    let key, result
    for (let key of conf.vault.unsealKeys) {
      if (!key || key === '(not-set)') {
        warn(`Skipping empty or invalid key`);
        continue;
      }

      result = await vault.unseal({ key });
      log(`Key applied. Sealed: ${result.sealed}`);
      if (!result.sealed) {
        log('Vault is now unsealed!');
        break
      }
    }

    status = await vault.status();
    log(`Vault status (after)> sealed: ${status.sealed}`);
  } catch (err) {
    error('Error during unseal process:', err.message || err);
  }
}

if (conf.vault.enable) {
  try {
    const options = {
      apiVersion: 'v1', // default
      endpoint: conf.vault.addr,
      token: conf.vault.token,
    };
    // verbose("vault options:", options)
    vault = NodeVault(options);
    log('Vault client is connected')
    // verbose("vault:", vault)
  } catch (error) {
    error('Vault client connection error:', error.message || error);
  }

  if (conf.vault.unseal) {
    unsealVault();
  }
}

function nullifyValues(data) {
  const onlyKeys = Object.fromEntries(
    Object.keys(data).map(key => [key, null])
  );
  return onlyKeys
}

const listSecrets = async (req, res, next) => {
  try {
    if (!vault) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const result = await vault.read(`secret/data/user_${userId}`);
    const data = result.data.data; // KV v2 nests data under data.data
    verbose('data:', data)
    const onlyKeys = nullifyValues(data)
    verbose('onlyKeys:', onlyKeys)
    res.json(onlyKeys)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const exposeSecret = async (req, res, next) => {
  try {
    if (!vault) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const result = await vault.read(`secret/data/user_${userId}`);
    const data = result.data.data; // KV v2 nests data under data.data
    console.log('expose req.body:', req.body)
    const { key } = req.body
    const expose = {
      [key]: data[key],
    }
    verbose('expose:', expose)
    res.json(expose)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const addSecret = async (req, res, next) => {
  try {
    if (!vault) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const readResult = await vault.read(`secret/data/user_${userId}`);
    verbose('vault readResult:', readResult)
    const data = readResult.data.data; // KV v2 nests data under data.data
    const { key, value } = req.body
    const newData = {
      ...data,
      [key]: value,
    }
    const writeResult = await vault.write(`secret/data/user_${userId}`, {
      data: newData,
    });
    verbose('vault writeResult:', writeResult)
    const onlyKeys = nullifyValues(newData)
    verbose('onlyKeys:', onlyKeys)
    res.json(onlyKeys)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const deleteSecret = async (req, res, next) => {
  try {
    if (!vault) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const readResult = await vault.read(`secret/data/user_${userId}`);
    verbose('vault readResult:', readResult)
    const data = readResult.data.data; // KV v2 nests data under data.data
    const { key } = req.body
    delete data[key]
    const newData = {
      ...data,
    }
    const writeResult = await vault.write(`secret/data/user_${userId}`, {
      data: newData,
    });
    verbose('vault writeResult:', writeResult)
    const onlyKeys = nullifyValues(newData)
    res.json(onlyKeys)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

router.get('/', checkAuth, listSecrets)
router.post('/expose', checkAuth, exposeSecret)
router.post('/', checkAuth, addSecret)
router.delete('/', checkAuth, deleteSecret)
// router.get('/api', checkAPIAuth, index)

export default router
