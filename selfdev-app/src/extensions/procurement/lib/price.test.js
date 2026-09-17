import test from 'node:test'
import assert from 'node:assert/strict'

import { formatPrice } from './price.js'

test('a complete price reads as amount, currency and unit', () => {
  assert.equal(formatPrice({ price: 3950, currency: 'USD', priceUnit: 'MT' }), '3950 USD/MT')
})

test('a missing currency or unit is never printed as null', () => {
  assert.equal(formatPrice({ price: 3998.4, currency: null, priceUnit: null }), '3998.4 · валюта не указана')
  assert.equal(formatPrice({ price: 3998.4, currency: 'null', priceUnit: 'null' }), '3998.4 · валюта не указана')
  assert.equal(formatPrice({ price: 12.37, currency: 'CNY', priceUnit: null }), '12.37 CNY')
  assert.equal(formatPrice({ price: 2.8, currency: '', priceUnit: 'KG' }), '2.8/KG · валюта не указана')
})

test('no amount means no price, whatever else is filled', () => {
  assert.equal(formatPrice({ price: null, currency: 'USD', priceUnit: 'KG' }), null)
  assert.equal(formatPrice(), null)
})
