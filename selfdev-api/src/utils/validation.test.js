import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResetToken, validatePassword } from './validation.js'

test('reset accepts only a token in the format /forgot generates', () => {
  assert.equal(validateResetToken('a'.repeat(64)), true)
  assert.equal(validateResetToken('0123456789abcdef'.repeat(4)), true)

  assert.equal(validateResetToken('a'.repeat(63)), false)
  assert.equal(validateResetToken('a'.repeat(65)), false)
  assert.equal(validateResetToken('A'.repeat(64)), false)
  assert.equal(validateResetToken('z'.repeat(64)), false)
  assert.equal(validateResetToken(''), false)
})

test('reset rejects a query operator in place of the token', () => {
  // A body of {"token": {"$ne": null}} used to pass `token.length < 32`,
  // because an object has no length and `undefined < 32` is false. The query
  // then matched the first user holding any unexpired token and overwrote
  // that account's password.
  assert.equal(validateResetToken({ $ne: null }), false)
  assert.equal(validateResetToken({ $gt: '' }), false)
  assert.equal(validateResetToken({ $regex: '^a' }), false)
  assert.equal(validateResetToken(['a'.repeat(64)]), false)
  assert.equal(validateResetToken(undefined), false)
  assert.equal(validateResetToken(null), false)
  assert.equal(validateResetToken(42), false)
})

test('reset holds a new password to the signup password policy', () => {
  assert.ok(validatePassword('Passw0rd!').valid)
  assert.ok(!validatePassword('password').valid)
  assert.ok(!validatePassword('Sh0rt!').valid)
  assert.ok(!validatePassword({ $ne: null }).valid)
})
