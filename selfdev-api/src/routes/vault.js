import { Router } from 'express'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'
import { vaultClient } from '../vault.js'

const verbose = Verbose('sd:routes/vault'); verbose('')
const router = Router()


function nullifyValues(data) {
  const onlyKeys = Object.fromEntries(
    Object.keys(data).map(key => [key, null])
  );
  return onlyKeys
}

const listSecrets = async (req, res, next) => {
  try {
    if (!vaultClient) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()

    let data = {}
    let result;
    try {
      result = await vaultClient.read(`secret/data/user_${userId}`);
      data = result.data.data; // KV v2 nests data under data.data
      // console.log('Secret exists:', result.data);
    } catch (err) {
      if (err.response && err.response.statusCode === 404) {
        log(`Secret does not exists for user_${userId}.`);
      } else {
        // Unexpected error, rethrow or handle differently
        console.error('Error reading secret:', err);
        throw err;
      }
    }

    // verbose('data:', data)
    const onlyKeys = nullifyValues(data)
    // verbose('onlyKeys:', onlyKeys)
    res.json(onlyKeys)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const exposeSecret = async (req, res, next) => {
  try {
    if (!vaultClient) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const result = await vaultClient.read(`secret/data/user_${userId}`);
    const data = result.data.data; // KV v2 nests data under data.data
    const { key } = req.body
    const expose = {
      [key]: data[key],
    }
    // verbose('expose:', expose)
    res.json(expose)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const addSecret = async (req, res, next) => {
  try {
    if (!vaultClient) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const { key, value } = req.body

    let data = {};
    try {
      const readResult = await vaultClient.read(`secret/data/user_${userId}`);
      // verbose('vaultClient readResult:', readResult);
      data = readResult.data.data; // KV v2: nested under data.data
    } catch (err) {
      if (err.response && err.response.statusCode === 404) {
        log(`Secret not found for user_${userId}, will create new one.`);
      } else {
        throw err; // Unexpected error
      }
    }

    const newData = {
      ...data,
      [key]: value,
    }
    const writeResult = await vaultClient.write(`secret/data/user_${userId}`, {
      data: newData,
    });
    // verbose('vaultClient writeResult:', writeResult)
    const onlyKeys = nullifyValues(newData)
    // verbose('onlyKeys:', onlyKeys)
    res.json(onlyKeys)
  } catch (err) {
    res.status(500).json({ result: 'error', message: err.toString()})
  }
}

const deleteSecret = async (req, res, next) => {
  try {
    if (!vaultClient) {
      throw new Error('Vault is disabled on backend')
    }
    const userId = req.user._id.toString()
    const readResult = await vaultClient.read(`secret/data/user_${userId}`);
    // verbose('vaultClient readResult:', readResult)
    const data = readResult.data.data; // KV v2 nests data under data.data
    const { key } = req.body
    delete data[key]
    const newData = {
      ...data,
    }
    const writeResult = await vaultClient.write(`secret/data/user_${userId}`, {
      data: newData,
    });
    // verbose('vaultClient writeResult:', writeResult)
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
