import { Router } from 'express'
import axios from 'axios'

import conf from '../conf.js'
import { checkAuth } from '../middleware/check-auth.js'
import { identityHeaders } from './extensions.js'

const router = Router()

const readablePaths = [
  /^\/overview$/,
  /^\/cards(?:\/[^/]+)?$/,
  /^\/suppliers(?:\/[^/]+)?$/,
  /^\/negotiations(?:\/[^/]+)?$/,
  /^\/proposals(?:\/[^/]+)?$/,
  /^\/proposals\/compare$/,
  /^\/escalations(?:\/[^/]+)?$/,
  /^\/activity$/,
]

export function isReadableProcurementPath(path) {
  return readablePaths.some(pattern => pattern.test(path))
}

export function normalizeProcurementResponse(status, data) {
  if (status < 400 || !data?.detail || typeof data.detail !== 'object') return data
  return {
    result: 'error',
    code: data.detail.code || 'UPSTREAM_ERROR',
    message: data.detail.message || 'Procurement request failed.',
  }
}

router.get('*', checkAuth, async (req, res) => {
  if (!conf.procurement.enabled) {
    return res.status(404).json({ result: 'error', code: 'EXTENSION_DISABLED', message: 'Procurement is disabled for this installation.' })
  }
  if (!conf.procurement.serviceUrl) {
    return res.status(503).json({ result: 'error', code: 'SERVICE_UNAVAILABLE', message: 'Procurement service is not configured.' })
  }
  if (!conf.procurement.serviceToken) {
    return res.status(503).json({ result: 'error', code: 'SERVICE_AUTH_NOT_CONFIGURED', message: 'Procurement service authentication is not configured.' })
  }
  if (!isReadableProcurementPath(req.path)) {
    return res.status(404).json({ result: 'error', code: 'ENDPOINT_NOT_ALLOWED', message: 'Procurement endpoint is not allow-listed by the gateway.' })
  }
  try {
    const upstream = await axios.get(`${conf.procurement.serviceUrl}${req.path}`, {
      params: req.query,
      headers: identityHeaders(req.user),
      timeout: conf.procurement.timeoutMs,
      validateStatus: () => true,
    })
    return res.status(upstream.status).json(
      normalizeProcurementResponse(upstream.status, upstream.data),
    )
  } catch (error) {
    return res.status(503).json({
      result: 'error',
      code: 'SERVICE_UNAVAILABLE',
      message: error.code === 'ECONNABORTED'
        ? 'Procurement service request timed out.'
        : 'Procurement service is unavailable.',
    })
  }
})

export default router
