import { read } from '../devMode'
import { request } from '../http'

/** Empty shapes rather than nulls: the dashboard renders its axes and its
 *  "nothing here yet" copy from the same structure it renders real data from,
 *  so demonstration mode exercises the real layout. */
const emptyFunnel = {
  window: null,
  discovery: { label: 'Поиск и проверка', available: true, steps: [] },
  outreach: { label: 'Переговоры', steps: [] },
  seam: '',
  cohortNote: '',
  truncated: false,
}

const emptyBottlenecks = {
  buckets: [], rows: [], total: 0, undated: 0, oldestDays: 0, truncated: false,
}

export const analyticsEndpoints = {
  analyticsFunnel: read(
    (params = {}, signal) => request('/analytics/funnel', { params, signal }),
    async () => emptyFunnel,
  ),
  analyticsBottlenecks: read(
    signal => request('/analytics/bottlenecks', { signal }),
    async () => emptyBottlenecks,
  ),
}
