/** What a contacted supplier's own website says, shown beside its offer.
 *
 * Asked for by the customer on 24.09.2026: one purity can be two products at
 * very different prices, and a site often states the grade before the
 * supplier's reply does. It is a hint, never the offer: the grade from the
 * reply stays in its own row, and this one is always labelled «с сайта» with
 * its source link and date. Nothing is filled in by guess — an unchecked,
 * unreachable or silent site reads «нет данных» with the reason.
 */

export const NO_DATA = 'нет данных'

const REASONS = {
  NOT_FOUND: 'на сайте не указан',
  NO_WEBSITE: 'сайт поставщика неизвестен',
  UNREACHABLE: 'сайт не открылся',
  STOPPED: 'проверка остановлена',
  PENDING: 'проверяем сайт…',
}

const DOCUMENT_LABELS = { coa: 'CoA', sds: 'SDS', tds: 'TDS' }

/** Lookups keyed by supplier id; a row without an id has no lookup. */
export function lookupsBySupplier(data) {
  return new Map((data?.siteLookups || []).filter(item => item.supplierId).map(item => [item.supplierId, item]))
}

/** Offer rows, then one column per contacted supplier that has not replied yet. */
export function comparisonColumns(data) {
  const rows = data?.rows || []
  const awaiting = (data?.awaitingSuppliers || []).map(item => ({
    ...item,
    id: `site:${item.supplierId}`,
    rowKey: `site:${item.supplierId}`,
    awaiting: true,
  }))
  return [...rows, ...awaiting]
}

/** A check is going: the table polls, shows its progress and offers to stop it.
 *
 * The run says so when the API reports one; a lookup still marked PENDING says
 * so too, for an answer from an API that predates runs. A supplier never
 * checked is not "in progress" — polling for it would never end.
 */
export function siteLookupsInProgress(data) {
  if (data?.siteRun) return Boolean(data.siteRun.running)
  return (data?.siteLookups || []).some(item => item.status === 'PENDING')
}

/** "Проверено 3 из 10 · грейд найден у 2", and the percentage for the bar. */
export function siteRunProgress(run) {
  if (!run?.total) return null
  const percent = Math.round((run.done / run.total) * 100)
  return {
    percent,
    running: Boolean(run.running),
    stopped: Boolean(run.stopped),
    text: `Проверено ${run.done} из ${run.total} · грейд найден у ${run.found}`,
    finishedAt: formatDateTime(run.finishedAt),
  }
}

const parse = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = value => parse(value)?.toLocaleDateString('ru-RU') || null

/** "24.09.2026, 13:22" — the time matters: a re-check the same day must show. */
export function formatDateTime(value) {
  const date = parse(value)
  return date ? date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
}

/** The grade cell: found grades with their source, or «нет данных» and why. */
export function siteGradeCell(lookup) {
  if (!lookup) return { found: false, text: NO_DATA, reason: null }
  if (lookup.status === 'FOUND' && lookup.grades?.length) {
    return {
      found: true,
      text: lookup.grades.map(item => item.label).join(', '),
      grades: lookup.grades,
      sourceUrl: lookup.sourceUrl || lookup.grades[0].sourceUrl,
      checkedAt: formatDate(lookup.checkedAt),
    }
  }
  if (lookup.status === 'PENDING') return { found: false, pending: true, text: REASONS.PENDING, reason: null }
  const reason = lookup.status == null ? 'ещё не проверяли' : REASONS[lookup.status] || null
  // When it was checked, so a re-check that finds the same nothing still shows.
  const checked = lookup.status && lookup.status !== 'STOPPED' ? formatDateTime(lookup.checkedAt) : null
  return { found: false, text: NO_DATA, reason: checked ? `${reason} · проверено ${checked}` : reason }
}

export function siteWaterCell(lookup) {
  const water = lookup?.water
  if (!water?.value) return { found: false, text: NO_DATA }
  return { found: true, text: water.value, quote: water.quote, sourceUrl: water.sourceUrl }
}

export function siteDocumentsCell(lookup) {
  const documents = Object.entries(lookup?.documents || {})
  if (!documents.length) return { found: false, text: NO_DATA, links: [] }
  return {
    found: true,
    text: documents.map(([kind]) => DOCUMENT_LABELS[kind] || kind.toUpperCase()).join(', '),
    links: documents.map(([kind, url]) => ({ label: DOCUMENT_LABELS[kind] || kind.toUpperCase(), url })),
  }
}

/** Mirrors the table search so a site grade can be searched like the reply's. */
export function siteSearchText(lookup) {
  return (lookup?.grades || []).map(item => item.label).join(' ')
}
