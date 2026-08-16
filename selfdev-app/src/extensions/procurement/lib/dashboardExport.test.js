import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CSV_HEADERS,
  csvCell,
  dashboardRows,
  exportFilename,
  slugify,
  toCsv,
} from './dashboardExport.js'

test('a value containing a comma cannot shift the columns', () => {
  assert.equal(csvCell('Шанхай, Китай'), '"Шанхай, Китай"')
})

test('a quote inside a value is doubled, as RFC 4180 requires', () => {
  assert.equal(csvCell('грейд "фарма"'), '"грейд ""фарма"""')
})

test('an absent value is an empty cell, not the text null', () => {
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(undefined), '')
})

test('a zero is written, because zero is a measurement', () => {
  assert.equal(csvCell(0), '0')
})

test('the file starts with a BOM so Excel reads Cyrillic headers', () => {
  const csv = toCsv([['Воронка', 'Кандидаты', 86, '', '', '']])
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes(CSV_HEADERS.join(',')))
})

test('rows are separated by CRLF, which is what spreadsheets expect', () => {
  const csv = toCsv([['a'], ['b']])
  assert.equal(csv.split('\r\n').length, 4)
})

test('every funnel step keeps the denominator it was measured against', () => {
  const rows = dashboardRows({
    funnel: {
      discovery: { label: 'Поиск', steps: [{ label: 'Кандидаты', count: 86, of: null, conversion: null }] },
      outreach: { label: 'Переговоры', steps: [{ label: 'RFQ отправлен', count: 7, of: 14, conversion: 0.5 }] },
    },
  })
  assert.deepEqual(rows[1], ['Воронка · Переговоры', 'RFQ отправлен', 7, 14, '50%', ''])
})

test('a section that has not loaded is skipped rather than exported as zeros', () => {
  // An absent measurement is not a measurement of zero.
  assert.deepEqual(dashboardRows({}), [])
})

test('a discovery half the deployment does not have is left out', () => {
  const rows = dashboardRows({
    funnel: {
      discovery: { available: false, steps: [{ label: 'Кандидаты', count: 0, of: null }] },
      outreach: { label: 'Переговоры', steps: [] },
    },
  })
  assert.deepEqual(rows, [])
})

test('an unreliable conversion carries its warning into the file', () => {
  const rows = dashboardRows({
    variants: {
      minSample: 12,
      rows: [{
        itemTitle: 'Опенер', variantLabel: 'короткий', sent: 7,
        replied: 3, quoted: 1, replyRate: 0.43, quoteRate: 0.14, reliable: false,
      }],
    },
  })
  assert.equal(rows[0][5], 'выборка меньше 12')
})

test('a benchmark row says whether each side was measured or declared', () => {
  const rows = dashboardRows({
    benchmark: {
      cases: 19,
      rows: [{
        label: 'Найдено кандидатов',
        human: { value: null, source: 'DECLARED' },
        agent: { value: 4.53, source: 'MEASURED', total: 86 },
      }],
    },
  })
  assert.equal(rows[0][5], 'эталон не задан')
  assert.deepEqual(rows[1], ['Человек и агент', 'Найдено кандидатов · агент', 4.53, 86, '', 'измерено системой'])
})

test('an unmeasurable transition exports its reason, not a zero duration', () => {
  const rows = dashboardRows({
    cycleTime: { transitions: [{ label: 'Ответ → котировка', medianDays: null, sample: 0 }] },
  })
  assert.equal(rows[0][2], '')
  assert.equal(rows[0][5], 'нет пар с обеими отметками времени')
})

test('silent assignments are exported apart from the latency distribution', () => {
  const rows = dashboardRows({
    cycleTime: { transitions: [], firstReply: { buckets: [{ label: '<6 ч', count: 5 }], measured: 5, silent: 3 } },
  })
  assert.deepEqual(rows.at(-1), ['Первый ответ', 'Заданий без ответа', 3, '', '', 'в распределение не входят'])
})

test('the traffic light exports confirmed and unreviewed as separate rows', () => {
  const rows = dashboardRows({
    supplyBase: { trafficLight: [{ label: 'Нужна проверка', confirmed: 9, unreviewed: 77, total: 86 }] },
  })
  assert.equal(rows[0][5], 'решение специалиста')
  assert.equal(rows[1][5], 'только автоскоринг')
})

test('a country nobody filled in is marked as a data gap in the file too', () => {
  const rows = dashboardRows({
    supplyBase: { geography: { total: 22, rows: [{ country: 'Страна не указана', count: 13, unknown: true }] } },
  })
  assert.equal(rows[0][5], 'пробел в данных')
})

test('the filename sorts by date and names the workspace', () => {
  const name = exportFilename('csv', { now: new Date('2026-08-16T10:00:00Z') })
  assert.equal(name, 'procurement-dashboard-2026-08-16.csv')
})

test('a chart filename survives a Russian title', () => {
  assert.equal(slugify('Светофор базы поставщиков'), 'светофор-базы-поставщиков')
})

test('a title of only punctuation still yields a usable filename', () => {
  assert.equal(slugify('— · —'), 'chart')
  assert.equal(slugify(''), 'chart')
})
