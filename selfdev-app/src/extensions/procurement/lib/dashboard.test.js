import test from 'node:test'
import assert from 'node:assert/strict'

import {
  barWidth,
  cohortIsEmpty,
  describeStep,
  percent,
  rateScale,
  windowParams,
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
