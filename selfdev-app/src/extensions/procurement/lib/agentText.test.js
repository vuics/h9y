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
