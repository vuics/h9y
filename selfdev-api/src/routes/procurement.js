import { Router } from 'express'
import axios from 'axios'

import conf from '../conf.js'
import { checkAuth } from '../middleware/check-auth.js'
import { identityHeaders } from './extensions.js'
import { PROCUREMENT_ENDPOINTS } from './procurementEndpoints.js'
import { isDenied } from './procurementGatewayPolicy.js'

const router = Router()

// Compile an OpenAPI path template into a fully anchored pattern. Each `{param}`
// becomes exactly one non-slash segment, so a parameter cannot absorb further
// segments and land on an endpoint that was never allow-listed. Literal text is
// escaped, so a path is matched literally rather than as a regex.
export function compilePathTemplate(template) {
  const source = template
    .split(/(\{[^}]+\})/)
    .map(part => (
      /^\{[^}]+\}$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ))
    .join('')
  return new RegExp(`^${source}$`)
}

const allowedByMethod = PROCUREMENT_ENDPOINTS
  .filter(endpoint => !isDenied(endpoint.method, endpoint.path))
  .reduce((byMethod, endpoint) => {
    const patterns = byMethod[endpoint.method] || (byMethod[endpoint.method] = [])
    patterns.push(compilePathTemplate(endpoint.path))
    return byMethod
  }, {})

export function isReadableProcurementPath(path) {
  return isAllowedProcurementRequest('GET', path)
}

export function isAllowedProcurementRequest(method, path) {
  return (allowedByMethod[method] || []).some(pattern => pattern.test(path))
}

export function normalizeProcurementResponse(status, data) {
  if (status < 400 || !data?.detail || typeof data.detail !== 'object') return data
  // FastAPI reports request-validation problems as a list. Collapsing that to a
  // generic message hides which field was wrong, which is exactly what a caller
  // needs in order to fix the request.
  if (Array.isArray(data.detail)) {
    const fields = data.detail.map(item => {
      const path = (item.loc || []).filter(part => part !== 'body').join('.')
      return path ? `${path}: ${item.msg}` : item.msg
    }).filter(Boolean)
    return {
      result: 'error',
      code: 'REQUEST_INVALID',
      message: fields.length ? `Некорректный запрос — ${fields.join('; ')}` : 'Procurement request failed.',
      details: data.detail,
    }
  }
  return {
    result: 'error',
    code: data.detail.code || 'UPSTREAM_ERROR',
    message: data.detail.message || 'Procurement request failed.',
    ...(data.detail.details === undefined ? {} : { details: data.detail.details }),
  }
}

router.all('*', checkAuth, async (req, res) => {
  if (!conf.procurement.enabled) {
    return res.status(404).json({ result: 'error', code: 'EXTENSION_DISABLED', message: 'Procurement is disabled for this installation.' })
  }
  if (!conf.procurement.serviceUrl) {
    return res.status(503).json({ result: 'error', code: 'SERVICE_UNAVAILABLE', message: 'Procurement service is not configured.' })
  }
  if (!conf.procurement.serviceToken) {
    return res.status(503).json({ result: 'error', code: 'SERVICE_AUTH_NOT_CONFIGURED', message: 'Procurement service authentication is not configured.' })
  }
  if (!isAllowedProcurementRequest(req.method, req.path)) {
    return res.status(404).json({ result: 'error', code: 'ENDPOINT_NOT_ALLOWED', message: 'Procurement endpoint is not allow-listed by the gateway.' })
  }
  try {
    const binaryResponse = req.method === 'GET' && (
      /^\/supplier-response-attachments\/[^/]+$/.test(req.path) ||
      req.path === '/proposals/export'
    )
    const upstream = await axios.request({
      method: req.method,
      url: `${conf.procurement.serviceUrl}${req.path}`,
      params: req.query,
      data: req.method === 'GET' ? undefined : req.body,
      headers: identityHeaders(req.user),
      timeout: req.path.endsWith('/responses')
        ? conf.procurement.responseTimeoutMs
        : req.path.startsWith('/card-imports')
          ? conf.procurement.importTimeoutMs
        : req.path.includes('/sourcing')
          ? conf.procurement.sourcingTimeoutMs
        : req.path.includes('/echemi') || req.path.includes('/web-form/')
          ? conf.procurement.echemiTimeoutMs
          : conf.procurement.timeoutMs,
      validateStatus: () => true,
      ...(binaryResponse ? { responseType: 'arraybuffer' } : {}),
    })
    if (binaryResponse && upstream.status < 400) {
      for (const header of ['content-type', 'content-disposition', 'content-length']) {
        if (upstream.headers[header]) res.set(header, upstream.headers[header])
      }
      return res.status(upstream.status).send(upstream.data)
    }
    let upstreamData = upstream.data
    if (binaryResponse && Buffer.isBuffer(upstream.data)) {
      try {
        upstreamData = JSON.parse(upstream.data.toString('utf8'))
      } catch {
        upstreamData = { detail: { code: 'UPSTREAM_ERROR', message: 'Procurement file request failed.' } }
      }
    }
    if (req.path.endsWith('/echemi/browser-access')) {
      res.set('Cache-Control', 'no-store')
    }
    return res.status(upstream.status).json(
      normalizeProcurementResponse(upstream.status, upstreamData),
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
