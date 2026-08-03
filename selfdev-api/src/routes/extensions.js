import { Router } from 'express'
import axios from 'axios'

import conf from '../conf.js'
import { checkAuth } from '../middleware/check-auth.js'

const router = Router()

function identityHeaders(user) {
  return {
    'x-selfdev-subject-id': String(user?._id || ''),
    'x-selfdev-subject-email': String(user?.email || ''),
    'x-selfdev-subject-roles': (user?.roles || []).join(','),
    ...(conf.procurement.serviceToken
      ? { authorization: `Bearer ${conf.procurement.serviceToken}` }
      : {}),
  }
}

export function disabledProcurementCapability(reason = 'Disabled by installation configuration') {
  return {
    id: 'procurement',
    title: 'Procurement',
    enabled: false,
    apiVersion: conf.procurement.extensionApiVersion,
    permissions: [],
    serviceAvailable: false,
    reason,
  }
}

router.get('/', checkAuth, async (req, res) => {
  if (!conf.procurement.enabled) {
    return res.json({ apiVersion: 1, extensions: [disabledProcurementCapability()] })
  }
  if (!conf.procurement.serviceUrl) {
    return res.json({
      apiVersion: 1,
      extensions: [{
        ...disabledProcurementCapability('PROCUREMENT_SERVICE_URL is not configured'),
        enabled: true,
      }],
    })
  }
  try {
    const response = await axios.get(`${conf.procurement.serviceUrl}/capabilities`, {
      headers: identityHeaders(req.user),
      timeout: conf.procurement.timeoutMs,
    })
    const capability = response.data || {}
    return res.json({
      apiVersion: 1,
      extensions: [{
        id: 'procurement',
        title: 'Procurement',
        enabled: capability.enabled === true,
        apiVersion: Number(capability.apiVersion),
        permissions: Array.isArray(capability.permissions) ? capability.permissions : [],
        serviceAvailable: true,
        reason: capability.reason,
      }],
    })
  } catch (error) {
    return res.json({
      apiVersion: 1,
      extensions: [{
        id: 'procurement',
        title: 'Procurement',
        enabled: true,
        apiVersion: conf.procurement.extensionApiVersion,
        permissions: [],
        serviceAvailable: false,
        reason: error.code === 'ECONNABORTED'
          ? 'Procurement capability check timed out'
          : 'Procurement service is unavailable',
      }],
    })
  }
})

export { identityHeaders }
export default router
