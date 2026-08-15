import test from 'node:test'
import assert from 'node:assert/strict'

import {
  barWidth,
  cohortIsEmpty,
  describeStep,
  durationIsReliable,
  formatDuration,
  percent,
  rateScale,
  share,
  trafficLightSummary,
  windowParams,
  worstFirst,
} from './dashboard.js'

test('a period button asks for exactly that many days back', () => {
  const now = new Date('2026-08-15T12:00:00.000Z')
  assert.deepEqual(windowParams(30, now), {
    from: '2026-07-16T12:00:00.000Z',
    to: '2026-08-15T12:00:00.000Z',
  })
})

test('a stage that converted anything is always visible', () => {
  // One supplier out of four hundred is a real result, not an empty track.
  assert.ok(barWidth(1, 400) >= 1.5)
})

test('a stage that converted nothing is drawn as nothing', () => {
  assert.equal(barWidth(0, 400), 0)
})

test('the entry step fills its own track', () => {
  assert.equal(barWidth(400, 400), 100)
})

test('an empty cohort cannot divide by zero', () => {
  assert.equal(barWidth(0, 0), 0)
  assert.equal(barWidth(5, 0), 0)
})

test('an unknown share reads as unknown rather than as zero', () => {
  assert.equal(percent(null), '—')
  assert.equal(percent(0), '0%')
  assert.equal(percent(0.457), '46%')
})

test('every stage below the entry carries its denominator', () => {
  assert.deepEqual(describeStep({ count: 84, of: 88, conversion: 0.9545 }), {
    value: '84', of: 'из 88 · 95%',
  })
})

test('the entry step has no denominator to show', () => {
  assert.deepEqual(describeStep({ count: 312, of: null, conversion: null }), {
    value: '312', of: null,
  })
})

test('a cohort whose entry step is zero counts as empty', () => {
  assert.equal(cohortIsEmpty({ steps: [{ count: 0 }, { count: 0 }] }), true)
  assert.equal(cohortIsEmpty({ steps: [{ count: 3 }] }), false)
  assert.equal(cohortIsEmpty(undefined), true)
})

test('variant bars scale to the best rate so realistic rates stay readable', () => {
  assert.equal(rateScale([{ replyRate: 0.6, quoteRate: 0.3 }]), 0.6)
})

test('a single weak variant is not stretched into a full bar', () => {
  // Scaling 8% to full width would read as a success rather than a warning.
  assert.equal(rateScale([{ replyRate: 0.08, quoteRate: 0.02 }]), 0.5)
})

test('a step of minutes is reported in minutes, not as zero days', () => {
  assert.deepEqual(formatDuration(0, 0.7), { value: '42', unit: 'мин', empty: false })
})

test('a step under a day is reported in hours', () => {
  assert.deepEqual(formatDuration(0.3, 7.2), { value: '7,2', unit: 'ч', empty: false })
})

test('a step of days is reported in days', () => {
  assert.deepEqual(formatDuration(2.1, 50.4), { value: '2,1', unit: 'дн', empty: false })
})

test('no measurable cases reads as no data, never as zero', () => {
  assert.deepEqual(formatDuration(null, null), { value: 'нет данных', unit: null, empty: true })
})

test('a median from too few cases is not treated as a duration', () => {
  assert.equal(durationIsReliable(4), false)
  assert.equal(durationIsReliable(5), true)
})

test('a share cannot divide by an empty denominator', () => {
  assert.equal(share(3, 0), 0)
  assert.equal(share(3, 6), 50)
})

test('a traffic light with one occupied colour says so', () => {
  const summary = trafficLightSummary([
    { status: 'GREEN', total: 0, unreviewed: 0 },
    { status: 'YELLOW', total: 86, unreviewed: 77 },
    { status: 'RED', total: 0, unreviewed: 0 },
  ])
  assert.equal(summary.single.status, 'YELLOW')
  assert.equal(summary.unreviewed, 77)
  assert.equal(summary.total, 86)
})

test('a traffic light spread across colours has no single answer', () => {
  const summary = trafficLightSummary([
    { status: 'GREEN', total: 2, unreviewed: 0 },
    { status: 'YELLOW', total: 5, unreviewed: 5 },
    { status: 'RED', total: 0, unreviewed: 0 },
  ])
  assert.equal(summary.single, null)
})

test('missing-field rows are ordered worst first', () => {
  const rows = [
    { field: 'price', share: 0.78 },
    { field: 'tds', share: 0.29 },
    { field: 'moq', share: 0.34 },
  ]
  assert.deepEqual(worstFirst(rows).map(row => row.field), ['tds', 'moq', 'price'])
})

test('a field with no responses yet sorts as though complete rather than worst', () => {
  // share === null means "nothing measured", which must not top a gap chart.
  const rows = [{ field: 'tds', share: null }, { field: 'moq', share: 0.34 }]
  assert.deepEqual(worstFirst(rows).map(row => row.field), ['moq', 'tds'])
})
