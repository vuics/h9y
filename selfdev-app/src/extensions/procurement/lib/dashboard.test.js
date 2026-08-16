import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BASELINE_FIELDS,
  barWidth,
  decimal,
  baselineFormValues,
  benchmarkWidths,
  describeDelta,
  durationWidth,
  cohortIsEmpty,
  describeStep,
  durationIsReliable,
  formatDuration,
  niceTicks,
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

test('each benchmark row is scaled to itself, never to a shared axis', () => {
  // Hours and counts share no unit; one axis across them invents a comparison.
  const hours = benchmarkWidths({ human: { value: 14 }, agent: { value: 2 } })
  assert.equal(hours.human, 100)
  assert.ok(hours.agent > 14 && hours.agent < 15)
})

test('a missing side of a benchmark row draws nothing rather than a zero bar', () => {
  const widths = benchmarkWidths({ human: { value: null }, agent: { value: 4.5 } })
  assert.equal(widths.human, 0)
  assert.equal(widths.agent, 100)
})

test('a row with neither side measured draws nothing at all', () => {
  assert.deepEqual(benchmarkWidths({ human: {}, agent: {} }), { human: 0, agent: 0 })
})

test('fewer hours reads as an improvement even though the number went down', () => {
  const delta = describeDelta({
    lowerIsBetter: true,
    delta: { difference: -12, ratio: 7, improved: true },
  })
  assert.equal(delta.improved, true)
  assert.equal(delta.arrow, '↑')
  assert.equal(delta.text, '7×')
})

test('an incomparable row has no delta to describe', () => {
  assert.equal(describeDelta({ delta: null }), null)
})

test('only labour hours are declarable on the agent side', () => {
  const declarable = BASELINE_FIELDS.filter(field => field.agentDeclared).map(f => f.key)
  assert.deepEqual(declarable, ['HOURS_PER_CASE'])
})

test('the baseline form is prefilled from the rows it will overwrite', () => {
  const values = baselineFormValues([
    { key: 'HOURS_PER_CASE', human: { value: 14 }, agent: { value: 1.8 } },
    { key: 'CANDIDATES_FOUND', human: { value: null }, agent: { value: 4.5 } },
  ])
  assert.equal(values.HUMAN_HOURS_PER_CASE, 14)
  assert.equal(values.AGENT_HOURS_PER_CASE, 1.8)
  // A measured agent figure is never offered as an input.
  assert.equal('AGENT_CANDIDATES_FOUND' in values, false)
  assert.equal(values.HUMAN_CANDIDATES_FOUND, '')
})

test('a step under a minute says so instead of showing zero minutes', () => {
  // "0 мин" recreates the instant-looking claim one unit lower down.
  assert.deepEqual(formatDuration(0, 0.004), {
    value: 'меньше минуты', unit: null, empty: false,
  })
})

test('decimals are shown with a comma, as a Russian reader expects', () => {
  assert.equal(decimal(0.3), '0,3')
  assert.equal(decimal(null), '—')
})

test('a measured duration always draws a visible bar', () => {
  // 36 minutes against a two-day scale is ~1%: an empty track would read as
  // "no data", which is a different statement.
  assert.ok(durationWidth(0.025, 2.1, true) >= 2)
})

test('a sub-minute step is still drawn, because it was still measured', () => {
  assert.ok(durationWidth(0, 2.1, true) >= 2)
})

test('an unmeasured transition draws nothing at all', () => {
  assert.equal(durationWidth(null, 2.1, false), 0)
})

test('a small count axis is labelled one by one', () => {
  assert.deepEqual(niceTicks(5), [0, 1, 2, 3, 4, 5])
})

test('a larger count axis keeps its gaps even', () => {
  const ticks = niceTicks(37)
  const gaps = ticks.slice(1).map((value, index) => value - ticks[index])
  assert.equal(new Set(gaps).size, 1)
  assert.ok(ticks[ticks.length - 1] >= 37)
})

test('an empty axis still has a top, so the chart keeps its shape', () => {
  assert.deepEqual(niceTicks(0), [0, 1])
})
