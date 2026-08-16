/** Getting the dashboard out of the browser: a spreadsheet and a slide image.
 *
 * The customer said at the demo that they would put this in front of their own
 * management, which decides both formats:
 *
 *   * **CSV is long-format**, one row per figure rather than a column per
 *     metric. Every row then carries its own denominator and where the number
 *     came from — a wide table would strand "34%" in a cell with nothing beside
 *     it, which is the failure this whole dashboard is built to avoid.
 *   * **PNG is per chart**, never the whole page. A full-page capture is a
 *     metre-tall strip that fits no slide; one chart per image is what actually
 *     gets pasted.
 *
 * The CSV is serialized from the payloads the charts already hold, so the file
 * and the screen cannot disagree. Nothing is recomputed here.
 */

const BOM = '﻿'

export const CSV_HEADERS = ['Раздел', 'Показатель', 'Значение', 'Из', 'Доля', 'Источник']

/** RFC 4180 quoting. A supplier name with a comma must not shift the columns. */
export function csvCell(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows, headers = CSV_HEADERS) {
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(','))
  // The BOM is what makes Excel open UTF-8 Cyrillic correctly; without it the
  // headers arrive as mojibake and the file looks broken rather than unlabelled.
  return `${BOM}${lines.join('\r\n')}\r\n`
}

const percentCell = value => (value == null ? '' : `${Math.round(value * 100)}%`)

const SOURCE_LABELS = { MEASURED: 'измерено системой', DECLARED: 'введено вручную' }

/** Every loaded section, flattened. A section still loading is skipped rather
 *  than exported as zeros — an absent measurement is not a measurement of zero. */
export function dashboardRows({ funnel, variants, bottlenecks, benchmark, cycleTime, supplyBase, offerQuality }) {
  const rows = []

  const cohort = (cohortData, label) => {
    for (const step of cohortData?.steps || []) {
      rows.push([
        `Воронка · ${label}`, step.label, step.count,
        step.of ?? '', percentCell(step.conversion), '',
      ])
    }
  }
  if (funnel) {
    if (funnel.discovery?.available !== false) cohort(funnel.discovery, funnel.discovery?.label)
    cohort(funnel.outreach, funnel.outreach?.label)
  }

  for (const row of variants?.rows || []) {
    const name = `${row.itemTitle} · ${row.variantLabel}`
    const note = row.reliable ? '' : `выборка меньше ${variants.minSample ?? 12}`
    rows.push(['Формулировки', `${name} — ответили`, row.replied, row.sent, percentCell(row.replyRate), note])
    rows.push(['Формулировки', `${name} — котировка`, row.quoted, row.sent, percentCell(row.quoteRate), note])
  }

  for (const row of bottlenecks?.rows || []) {
    for (const bucket of bottlenecks.buckets || []) {
      const count = row.buckets?.[bucket.key] ?? 0
      if (count) rows.push(['Эскалации', `${row.label} · ${bucket.label}`, count, row.total, '', ''])
    }
  }

  for (const row of benchmark?.rows || []) {
    rows.push([
      'Человек и агент', `${row.label} · человек`, row.human?.value ?? '', '', '',
      row.human?.value == null ? 'эталон не задан' : SOURCE_LABELS.DECLARED,
    ])
    rows.push([
      'Человек и агент', `${row.label} · агент`, row.agent?.value ?? '',
      row.agent?.total ?? '', '',
      row.agent?.source ? SOURCE_LABELS[row.agent.source] : '',
    ])
  }
  if (benchmark) {
    rows.push(['Человек и агент', 'Кейсов за период', benchmark.cases, '', '', benchmark.caseNote || ''])
  }

  for (const item of cycleTime?.transitions || []) {
    rows.push([
      'Сроки', item.label,
      item.medianDays == null ? '' : item.medianDays, item.sample, '',
      item.medianDays == null ? 'нет пар с обеими отметками времени' : 'медиана, дней',
    ])
  }
  for (const bucket of cycleTime?.firstReply?.buckets || []) {
    rows.push(['Первый ответ', bucket.label, bucket.count, cycleTime.firstReply.measured, '', ''])
  }
  if (cycleTime?.firstReply?.silent) {
    rows.push(['Первый ответ', 'Заданий без ответа', cycleTime.firstReply.silent, '', '', 'в распределение не входят'])
  }

  for (const row of supplyBase?.trafficLight || []) {
    rows.push(['Светофор', `${row.label} · подтверждено`, row.confirmed, row.total, '', 'решение специалиста'])
    rows.push(['Светофор', `${row.label} · без проверки`, row.unreviewed, row.total, '', 'только автоскоринг'])
  }
  for (const row of supplyBase?.roles?.rows || []) {
    rows.push(['Роли', row.label, row.count, supplyBase.roles.verifiedTotal, '', 'только подтверждённые кандидаты'])
  }
  for (const row of supplyBase?.geography?.rows || []) {
    rows.push(['География', row.country, row.count, supplyBase.geography.total, '', row.unknown ? 'пробел в данных' : ''])
  }

  for (const row of offerQuality?.rows || []) {
    rows.push([
      'Полнота предложений', row.label, row.present, row.of, percentCell(row.share),
      row.isDocument ? 'документ' : '',
    ])
  }

  return rows
}

/** `dashboard-2026-08-16.csv` — sortable, and unambiguous next to last month's. */
export function exportFilename(extension, { name = 'dashboard', now = new Date() } = {}) {
  const stamp = now.toISOString().slice(0, 10)
  return `procurement-${name}-${stamp}.${extension}`
}

/** A filename fragment from a chart title, safe on every filesystem. */
export function slugify(title) {
  return String(title || 'chart')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'chart'
}
