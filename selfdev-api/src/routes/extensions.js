import { Router } from 'express'
import axios from 'axios'

import conf from '../conf.js'
import { checkAuth } from '../middleware/check-auth.js'

/** Deployment switches the upstream service reports, as booleans only.
 *
 * The capability payload is rebuilt field by field rather than forwarded, so a
 * new switch has to be listed here to reach the browser. Coercing to boolean
 * keeps an upstream `"false"` string from arriving as a truthy value in the UI.
 */
export function normalizeFeatures(features) {
  if (!features || typeof features !== 'object') return {}
  return Object.fromEntries(
    Object.entries(features)
      .filter(([, value]) => typeof value === 'boolean' || typeof value === 'string')
      .map(([key, value]) => [key, value === true || value === 'true']),
  )
}


const router = Router()

// The organization a person picked in the workspace, when they belong to
// several. Forwarded only in its own shape; the procurement service decides
// whether the person may work there and ignores the choice otherwise, so a
// forged value can at most select one's own organization.
const ORGANIZATION_HEADER = 'x-procurement-organization'
const ORGANIZATION_ID = /^[a-z][a-z0-9_]{1,31}$/

function organizationHeader(req) {
  const value = String(req?.headers?.[ORGANIZATION_HEADER] || '').trim()
  return ORGANIZATION_ID.test(value) ? { [ORGANIZATION_HEADER]: value } : {}
}

function identityHeaders(user) {
  return {
    'x-selfdev-subject-id': String(user?._id || ''),
    'x-selfdev-subject-email': String(user?.email || ''),
    accept: 'application/json',
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
    features: {},
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
  if (!conf.procurement.serviceToken) {
    return res.json({
      apiVersion: 1,
      extensions: [{
        ...disabledProcurementCapability('PROCUREMENT_SERVICE_TOKEN is not configured'),
        enabled: true,
      }],
    })
  }
  try {
    const response = await axios.get(`${conf.procurement.serviceUrl}/capabilities`, {
      headers: { ...identityHeaders(req.user), ...organizationHeader(req) },
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
        features: normalizeFeatures(capability.features),
        // Which organization this person works in; null on an installation
        // with a single organization or for someone added to none yet.
        organization: capability.organization && typeof capability.organization === 'object'
          ? { id: String(capability.organization.id || ''), name: String(capability.organization.name || '') }
          : null,
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
        // The service is unreachable, so nothing it gates can be offered: an
        // absent flag must not read as "enabled" while the check is failing.
        features: {},
        serviceAvailable: false,
        reason: error.code === 'ECONNABORTED'
          ? 'Procurement capability check timed out'
          : 'Procurement service is unavailable',
      }],
    })
  }
})

export { identityHeaders, organizationHeader }
export default router
