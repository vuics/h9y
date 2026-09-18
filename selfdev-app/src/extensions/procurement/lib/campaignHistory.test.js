import test from 'node:test'
import assert from 'node:assert/strict'

import { historyLine } from './campaignHistory.js'

test('a setting change says what it was and what it became', () => {
  const line = historyLine({
    kind: 'PLAN_CHANGED',
    actor: 'user:1',
    data: { changes: { confirm_candidates: { from: true, to: false }, reach: { from: 'CONTACTS', to: 'OUTREACH' } }, requeued: 2 },
  })
  assert.equal(line.main, true)
  assert.equal(line.who, 'специалист')
  assert.equal(line.text, 'Настройки изменены — Проверять найденных поставщиков: да → нет; Довести до: поиск и контакты → до рассылки запросов; продолжено веществ: 2')
})

test('a substance step is a detail line naming the substance', () => {
  const line = historyLine({ kind: 'SEARCH_FINISHED', cardId: 376, data: { title: 'Toluene', candidates: 4 } })
  assert.equal(line.main, false)
  assert.equal(line.text, 'Toluene: поиск закончен, кандидатов 4')
})

test('the agent is named as the agent, with what it could not do', () => {
  const line = historyLine({ kind: 'AUTOPILOT', actor: 'user:1', data: { title: 'Toluene', verified: 3, rfqApproved: true, errors: [] } })
  assert.equal(line.who, 'агент')
  assert.equal(line.text, 'Агент по Toluene: подтвердил 3 компании, согласовал RFQ')
  const blocked = historyLine({ kind: 'AUTOPILOT', data: { title: 'PEG-12', errors: ['CARD_NOT_NORMALIZED'] } })
  assert.equal(blocked.text, 'Агент по PEG-12: ничего не сделал; не сделано: карточка не нормализована')
})

test('an unknown kind is still shown rather than dropped', () => {
  assert.equal(historyLine({ kind: 'SOMETHING_NEW' }).text, 'SOMETHING_NEW')
})
