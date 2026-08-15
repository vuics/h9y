import axios from 'axios'

import conf from '../../../conf'
import { compactParams, timeoutFor } from './httpRules'

export { compactParams, id, timeoutFor } from './httpRules'

export function procurementUrl(path) {
  return `${conf.api.url}/procurement${path}`
}

export async function request(path, { method = 'get', params, data, signal } = {}) {
  const response = await axios.request({
    method,
    url: procurementUrl(path),
    params: compactParams(params),
    data,
    withCredentials: true,
    signal,
    timeout: timeoutFor(path),
  })
  return response.data
}
