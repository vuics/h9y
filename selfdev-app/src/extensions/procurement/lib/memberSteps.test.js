import test from 'node:test'
import assert from 'node:assert/strict'

import { memberStageLabel, memberSteps } from './memberSteps.js'

const statuses = result => result.steps.map(step => step.status)

test('a search in progress: the agent holds the first step, the rest is ahead', () => {
  const result = memberSteps({ stage: 'SOURCING' }, { confirmCandidates: true })
  assert.deepEqual(statuses(result), ['working', 'todo', 'todo', 'todo', 'todo', 'todo'])
  assert.equal(result.next, 'Дальше вы подтвердите, кому писать.')
})

test('waiting for the company decision says the letters have not gone', () => {
  const result = memberSteps({ stage: 'AWAITING_REVIEW', waitingFor: 'CANDIDATE_REVIEW' })
  assert.deepEqual(statuses(result), ['done', 'waiting', 'todo', 'todo', 'todo', 'todo'])
  assert.match(result.next, /Письма пока не уходят/)
})

test('waiting for the RFQ says how many companies it goes to', () => {
  const result = memberSteps({ stage: 'AWAITING_REVIEW', waitingFor: 'RFQ_APPROVAL', verifiedCount: 3 })
  assert.deepEqual(statuses(result), ['done', 'done', 'waiting', 'todo', 'todo', 'todo'])
  assert.equal(result.next, 'После согласования агент напишет подтверждённым компаниям: 3.')
})

test('sent, no answer yet: not finished, whatever the stage is called', () => {
  const result = memberSteps({ stage: 'DONE', requestCount: 3 })
  assert.deepEqual(statuses(result), ['done', 'done', 'done', 'done', 'working', 'todo'])
  assert.equal(result.now, 'Запросы отправлены, ждём ответы поставщиков.')
})

test('an answer without a price leaves the last step open', () => {
  const result = memberSteps({ stage: 'DONE', requestCount: 2, responseCount: 1 }, {}, { offers: [{}], priced: 0 })
  assert.deepEqual(statuses(result), ['done', 'done', 'done', 'done', 'done', 'todo'])
  assert.equal(result.now, 'Есть ответы, но цены пока нет.')
})

test('a price finishes the row, even from the marketplace with no letter counted', () => {
  const result = memberSteps({ stage: 'NEGOTIATION', requestCount: 0 }, {}, { offers: [{}], priced: 1 })
  assert.deepEqual(statuses(result), ['done', 'done', 'done', 'done', 'done', 'done'])
})

test('a plan that stops at the search shows the rest as not happening', () => {
  const result = memberSteps({ stage: 'DONE' }, { reach: 'SOURCING' })
  assert.deepEqual(statuses(result), ['done', 'off', 'off', 'off', 'off', 'off'])
})

test('a failure marks the step it happened on', () => {
  const result = memberSteps({ stage: 'FAILED', candidateCount: 4 })
  assert.deepEqual(statuses(result), ['done', 'failed', 'todo', 'todo', 'todo', 'todo'])
})

test('the row does not call a substance with letters out finished', () => {
  const labels = { DONE: 'Готово', OUTREACH: 'Рассылка' }
  assert.equal(memberStageLabel({ stage: 'DONE', requestCount: 2 }, labels), 'Запросы отправлены')
  assert.equal(memberStageLabel({ stage: 'DONE' }, labels), 'Готово')
  assert.equal(memberStageLabel({ stage: 'OUTREACH' }, labels), 'Рассылка')
})
