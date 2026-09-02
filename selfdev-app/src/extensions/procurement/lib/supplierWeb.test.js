import test from 'node:test'
import assert from 'node:assert/strict'

import { supplierLinkLabel } from './supplierWeb.js'

test('a marketplace inquiry page is not called the supplier own site', () => {
  assert.equal(supplierLinkLabel('https://i.echemi.com/inquiry/detail.html?id=lea26'), 'Профиль на Echemi')
  assert.equal(supplierLinkLabel('https://www.echemi.com/company/x.html'), 'Профиль на Echemi')
})

test('a company domain is named as the supplier site', () => {
  assert.equal(supplierLinkLabel('https://www.dideu.com/en/'), 'Сайт поставщика')
  assert.equal(supplierLinkLabel('http://sdzschem.com/'), 'Сайт поставщика')
  // Matching is on the host, so a lookalike inside the path is not a match.
  assert.equal(supplierLinkLabel('https://supplier.example/echemi.com'), 'Сайт поставщика')
})

test('an unparseable value falls back rather than throwing', () => {
  assert.equal(supplierLinkLabel('not a url'), 'Сайт поставщика')
  assert.equal(supplierLinkLabel(undefined), 'Сайт поставщика')
})
