import { mutation, read } from '../devMode'
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

const emptyCycleTime = {
  window: null, transitions: [],
  firstReply: { buckets: [], measured: 0, silent: 0, note: '' },
}

const emptySupplyBase = {
  trafficLight: [], roles: { rows: [], verifiedTotal: 0, manufacturerShare: null, note: '' },
  geography: { rows: [], unknown: 0, total: 0 },
  awaitingReview: 0, candidateTotal: 0, supplierTotal: 0, sourcingAvailable: true,
}

const emptyOfferQuality = { rows: [], total: 0, completeness: [], note: '' }

const emptyBenchmark = {
  window: null, cases: 0, rows: [],
  baseline: { recordedAt: null, recordedBy: null, note: null, present: false },
  provenanceNote: '', caseNote: '',
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
  analyticsCycleTime: read(
    (params = {}, signal) => request('/analytics/cycle-time', { params, signal }),
    async () => emptyCycleTime,
  ),
  analyticsSupplyBase: read(
    signal => request('/analytics/supply-base', { signal }),
    async () => emptySupplyBase,
  ),
  analyticsOfferQuality: read(
    signal => request('/analytics/offer-quality', { signal }),
    async () => emptyOfferQuality,
  ),
  analyticsBenchmark: read(
    (params = {}, signal) => request('/analytics/benchmark', { params, signal }),
    async () => emptyBenchmark,
  ),
  saveBenchmarkBaseline: mutation(({ metrics, note }) =>
    request('/analytics/benchmark/baseline', { method: 'put', data: { metrics, note } })),
}
