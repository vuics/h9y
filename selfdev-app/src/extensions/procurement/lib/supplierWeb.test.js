import test from 'node:test'
import assert from 'node:assert/strict'

import {
  emailDomain, isFreeMailDomain, registrableDomain, siteHostLabel,
  supplierLinkLabel, websiteCandidates, websiteDomainMismatch,
} from './supplierWeb.js'

const email = (address, extra = {}) => ({ channel: 'email', address, ...extra })

test('a marketplace inquiry page is not called the supplier own site', () => {
  assert.equal(supplierLinkLabel('https://i.echemi.com/inquiry/detail.html?id=lea26'), 'Профиль на Echemi')
  assert.equal(supplierLinkLabel('https://www.dideu.com/en/'), 'Сайт поставщика')
  // Matching is on the host, so a lookalike inside the path is not a match.
  assert.equal(supplierLinkLabel('https://supplier.example/echemi.com'), 'Сайт поставщика')
  assert.equal(supplierLinkLabel('not a url'), 'Сайт поставщика')
})

test('a company is identified by its registrable domain, not its host', () => {
  assert.equal(registrableDomain('www.leapchem.com'), 'leapchem.com')
  assert.equal(registrableDomain('i.echemi.com'), 'echemi.com')
  assert.equal(registrableDomain('mail.sinochem.com.cn'), 'sinochem.com.cn')
  assert.equal(emailDomain('sales60@leapchem.com'), 'leapchem.com')
  assert.equal(emailDomain('not-an-address'), null)
})

test('public mailboxes are never treated as a company domain', () => {
  // Xiamen Eagle writes from 163.com; the free provider says nothing about them.
  assert.equal(isFreeMailDomain('163.com'), true)
  assert.equal(isFreeMailDomain('gmail.com'), true)
  assert.equal(isFreeMailDomain('vip.163.com'), true)
  assert.equal(isFreeMailDomain('minglangchem.com'), false)
})

test('candidates come from corporate contact domains, most used first', () => {
  const contacts = [
    email('sales@minglangchem.com'),
    email('mark@minglangchem.com'),
    email('someone@163.com'),
    { channel: 'phone', address: '+86123' },
    email('old@minglangchem.com', { active: false }),
    email('info@another-domain.com'),
  ]
  assert.deepEqual(websiteCandidates(contacts), ['minglangchem.com', 'another-domain.com'])
})

test('a domain that is already the stored site is not suggested again', () => {
  const contacts = [email('sales@leapchem.com')]
  assert.deepEqual(websiteCandidates(contacts, 'https://www.leapchem.com/'), [])
  // The Echemi profile is not this company's domain, so the suggestion stands.
  assert.deepEqual(
    websiteCandidates(contacts, 'https://i.echemi.com/inquiry/detail.html?id=x'),
    ['leapchem.com'],
  )
})

test('a contact writing from another company is surfaced, not swallowed', () => {
  // The real case: an Echemi listing under one name carrying another firm's address.
  const mismatch = websiteDomainMismatch('https://xahonest.com/', [
    email('sales4@faithfulbio.com', { name: 'Angela' }),
    email('info@xahonest.com'),
    email('someone@163.com'),
  ])
  assert.deepEqual(mismatch.map(item => item.domain), ['faithfulbio.com'])
  assert.equal(mismatch[0].name, 'Angela')
})

test('the mismatch flag stays quiet where it could only mislead', () => {
  // No site on file: nothing to disagree with.
  assert.deepEqual(websiteDomainMismatch('', [email('a@b.com')]), [])
  // A marketplace profile is not the company's domain, so every contact would
  // "mismatch" it and the flag would fire on every such supplier.
  assert.deepEqual(
    websiteDomainMismatch('https://i.echemi.com/inquiry/detail.html?id=x', [email('a@b.com')]),
    [],
  )
  // Subdomains and www are the same company.
  assert.deepEqual(websiteDomainMismatch('https://www.dideu.com/en/', [email('s@mail.dideu.com')]), [])
})


test('a site link in a table reads as the host, not as the whole URL', () => {
  assert.equal(siteHostLabel('https://www.dideu.com/en/products?utm_source=x'), 'dideu.com')
  assert.equal(siteHostLabel('http://SHANDONG.example.CN/'), 'shandong.example.cn')
  // Whatever is on the card is shown as it stands rather than dropped: a value
  // that is not a URL is still what somebody typed there.
  assert.equal(siteHostLabel('dideu.com'), 'dideu.com')
  assert.equal(siteHostLabel(null), '')
})
