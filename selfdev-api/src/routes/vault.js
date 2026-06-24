import { Router } from 'express'

import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import conf from '../conf.js'
import { vaultClient } from '../vault.js'
import Secret from '../models/secret.js'

const verbose = Verbose('sd:routes/vault'); verbose('')
const router = Router()

// process.nextTick(async () => {
//   await Secret.collection.drop()
// })

function nullifyValues(data) {
  const onlyKeys = Object.fromEntries(
    Object.keys(data).map(key => [key, null])
  );
  return onlyKeys
}

/**
 * Normalize Vault + Mongo output into { key: value }
 */
function normalizeVaultData(data = {}) {
  return data || {}
}


/**
 * =========================
 * Secret Providers
 * =========================
 */

async function listSecretsFromMongo(userId) {
  const secrets = await Secret.find({ userId }).lean()

  const data = {}
  for (const s of secrets) {
    data[s.key] = s.value
  }

  return data
}

async function listSecretsUnified(userId) {
  if (vaultClient) {
    try {
      const result = await vaultClient.read(
        `secret/data/user_${userId}`
      )

      return normalizeVaultData(result?.data?.data)
    } catch (err) {
      if (err.response?.statusCode === 404) {
        return {}
      }
      throw err
    }
  }

  return await listSecretsFromMongo(userId)
}

async function getSecret(userId, key) {
  const data = await listSecretsUnified(userId)
  return data[key]
}

async function setSecret(userId, key, value) {
  if (vaultClient) {
    const data = await listSecretsUnified(userId)

    await vaultClient.write(
      `secret/data/user_${userId}`,
      {
        data: {
          ...data,
          [key]: value,
        },
      }
    )

    return
  }

  await Secret.findOneAndUpdate(
    { userId, key },
    { value },
    { upsert: true, new: true }
  )
}

async function deleteSecret(userId, key) {
  if (vaultClient) {
    const data = await listSecretsUnified(userId)

    delete data[key]

    await vaultClient.write(
      `secret/data/user_${userId}`,
      {
        data,
      }
    )

    return
  }

  await Secret.deleteOne({ userId, key })
}

/**
 * =========================
 * Routes
 * =========================
 */

const listSecrets = async (req, res) => {
  try {
    const userId = req.user._id.toString()

    const data = await listSecretsUnified(userId)

    res.json(nullifyValues(data))
  } catch (err) {
    res.status(500).json({
      result: 'error',
      message: err.toString(),
    })
  }
}

const exposeSecret = async (req, res) => {
  try {
    const userId = req.user._id.toString()
    const { key } = req.body

    const value = await getSecret(userId, key)

    res.json({
      [key]: value,
    })
  } catch (err) {
    res.status(500).json({
      result: 'error',
      message: err.toString(),
    })
  }
}

const addSecret = async (req, res) => {
  try {
    const userId = req.user._id.toString()
    const { key, value } = req.body

    await setSecret(userId, key, value)

    const data = await listSecretsUnified(userId)

    res.json(nullifyValues(data))
  } catch (err) {
    res.status(500).json({
      result: 'error',
      message: err.toString(),
    })
  }
}

const deleteSecretRoute = async (req, res) => {
  try {
    const userId = req.user._id.toString()
    const { key } = req.body

    await deleteSecret(userId, key)

    const data = await listSecretsUnified(userId)

    res.json(nullifyValues(data))
  } catch (err) {
    res.status(500).json({
      result: 'error',
      message: err.toString(),
    })
  }
}

router.get('/', checkAuth, listSecrets)
router.post('/expose', checkAuth, exposeSecret)
router.post('/', checkAuth, addSecret)
router.delete('/', checkAuth, deleteSecretRoute)

// router.get('/api', checkAPIAuth, index)

export default router
