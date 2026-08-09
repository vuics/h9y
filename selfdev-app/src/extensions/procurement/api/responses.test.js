import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResponseInput } from './responses.js'

test('supplier response requires text or an attachment and enforces bounded uploads', () => {
  assert.match(validateResponseInput('', []), /текст ответа/)
  assert.equal(validateResponseInput('USD 10/kg', []), null)
  assert.equal(validateResponseInput('', [{ size: 100 }]), null)
  assert.match(validateResponseInput('', Array.from({ length: 6 }, () => ({ size: 1 }))), /не более 5/)
  assert.match(validateResponseInput('', [{ size: 11 * 1024 * 1024 }]), /10 МБ/)
})
