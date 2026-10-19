import { plural } from './dashboard.js'

// One line for what «Нормализовать (N)» did, from the server's per-card
// outcomes. A doubt and a failure are named first: those need a person.
export function normalizeSummary(result) {
  const tally = { NORMALIZED: 0, UNCONFIRMED: 0, FAILED: 0, SKIPPED: 0 }
  for (const item of result?.results || []) tally[item.outcome] = (tally[item.outcome] || 0) + 1
  const parts = []
  if (tally.UNCONFIRMED) parts.push(`не подтверждено PubChem: ${tally.UNCONFIRMED} — проверьте ${plural(tally.UNCONFIRMED, 'карточку', 'карточки', 'карточек')}`)
  if (tally.FAILED) parts.push(`не удалось: ${tally.FAILED}`)
  if (tally.NORMALIZED) parts.push(`нормализовано: ${tally.NORMALIZED}`)
  if (tally.SKIPPED) parts.push(`уже были нормализованы: ${tally.SKIPPED}`)
  return parts.join('; ') || 'Нечего нормализовать'
}
