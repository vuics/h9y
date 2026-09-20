import test from 'node:test'
import assert from 'node:assert/strict'

import { readableAgentError } from './agentText.js'

test('the code and marker lines meant for the agent are not shown to the purchaser', () => {
  assert.equal(
    readableAgentError("ECHEMI_INQUIRY_NOT_READY: целевой объём карточки невозможно сопоставить: '800'. Укажите объём. Inquiry created: NO"),
    "целевой объём карточки невозможно сопоставить: '800'. Укажите объём.",
  )
  assert.equal(readableAgentError('Заявка уже размещена.\nInquiry created: NO\nStatus: SUBMITTED'), 'Заявка уже размещена.')
  assert.equal(readableAgentError('Карточка не нормализована'), 'Карточка не нормализована')
})

test('a message recorded before the browser spoke Russian is translated on the way out', () => {
  assert.equal(
    readableAgentError('ECHEMI-357-52C3BB59. The submit control was clicked, but no configured Echemi success confirmation was detected. Do not retry automatically.'),
    'ECHEMI-357-52C3BB59. Кнопка отправки нажата, но подтверждения площадки мы не увидели. Повторять автоматически не будем: заявка могла уйти. Проверьте её в браузере.',
  )
  assert.equal(readableAgentError('Failed. The page said: quantity is required'), 'Failed. Площадка сказала: quantity is required')
})
