import { Router } from 'express'
import axios from 'axios'

import conf from '../conf.js'
import { checkAuth } from '../middleware/check-auth.js'
import { identityHeaders } from './extensions.js'

const router = Router()

const readablePaths = [
  /^\/overview$/,
  /^\/overview\/board$/,
  /^\/cards(?:\/[^/]+)?$/,
  /^\/card-imports(?:\/[^/]+)?$/,
  /^\/cards\/[^/]+\/rfq$/,
  /^\/cards\/[^/]+\/echemi$/,
  /^\/cards\/[^/]+\/echemi\/browser-access$/,
  /^\/cards\/[^/]+\/sourcing$/,
  /^\/sourcing\/[^/]+$/,
  /^\/suppliers(?:\/[^/]+)?$/,
  /^\/negotiations(?:\/[^/]+)?$/,
  /^\/negotiations\/[^/]+\/web-form$/,
  /^\/supplier-response-attachments\/[^/]+$/,
  /^\/proposals(?:\/[^/]+)?$/,
  /^\/proposals\/export$/,
  /^\/proposals\/compare$/,
  /^\/escalations(?:\/[^/]+)?$/,
  /^\/activity$/,
]

const writablePaths = {
  POST: [
    /^\/cards$/,
    /^\/card-imports$/,
    /^\/card-imports\/[^/]+\/(?:confirm|normalize|cancel)$/,
    /^\/cards\/[^/]+\/normalize$/,
    /^\/cards\/[^/]+\/rfq\/prepare$/,
    /^\/cards\/[^/]+\/rfq\/approve$/,
    /^\/cards\/[^/]+\/echemi\/search$/,
    /^\/cards\/[^/]+\/echemi\/inquiries$/,
    /^\/cards\/[^/]+\/echemi\/listings\/[^/]+\/supplier$/,
    /^\/cards\/[^/]+\/echemi\/inquiries\/[^/]+\/(?:preview|approve|submit)$/,
    /^\/cards\/[^/]+\/sourcing\/runs$/,
    /^\/sourcing\/[^/]+\/cancel$/,
    /^\/sourcing\/[^/]+\/sources$/,
    /^\/sourcing\/[^/]+\/sources\/[^/]+\/retry$/,
    /^\/sourcing\/[^/]+\/candidates\/[^/]+\/(?:review|promote)$/,
    /^\/suppliers$/,
    /^\/suppliers\/[^/]+\/capabilities$/,
    /^\/suppliers\/[^/]+\/contacts$/,
    /^\/negotiations$/,
    /^\/negotiations\/[^/]+\/(?:queue|follow-up)$/,
    /^\/negotiations\/[^/]+\/web-form\/(?:prepare|preview|approve|submit)$/,
    /^\/negotiations\/[^/]+\/responses$/,
    /^\/proposals\/[^/]+\/clarification$/,
    /^\/escalations\/[^/]+\/(?:claim|recommendations|resolution)$/,
  ],
  PATCH: [
    /^\/cards\/[^/]+$/,
    /^\/card-imports\/[^/]+\/mapping$/,
    /^\/suppliers\/[^/]+\/contacts\/[^/]+$/,
    /^\/suppliers\/[^/]+$/,
    /^\/suppliers\/[^/]+\/qualification$/,
  ],
  PUT: [
    /^\/sourcing\/query-templates$/,
  ],
}

export function isReadableProcurementPath(path) {
  return readablePaths.some(pattern => pattern.test(path))
}

export function isAllowedProcurementRequest(method, path) {
  if (method === 'GET') return isReadableProcurementPath(path)
  return (writablePaths[method] || []).some(pattern => pattern.test(path))
}

export function normalizeProcurementResponse(status, data) {
  if (status < 400 || !data?.detail || typeof data.detail !== 'object') return data
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
        : req.path.includes('/echemi')
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
