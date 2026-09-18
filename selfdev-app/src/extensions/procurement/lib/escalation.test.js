import test from 'node:test'
import assert from 'node:assert/strict'

import { escalationKind, escalationSubject } from './escalation.js'

test('category codes in the stored title are never shown', () => {
  const item = { title: 'Ручная оценка: HUMAN_REVIEW, PRODUCT_IDENTITY', risks: [] }
  assert.equal(escalationKind(item), 'Идентичность продукта')
})

test('the risks win over the title when both are present', () => {
  const item = {
    title: 'Ручная оценка: PRODUCT_IDENTITY',
    risks: [{ category: 'DOCUMENT_MISMATCH' }, { category: 'DANGEROUS_LOGISTICS' }],
  }
  assert.equal(escalationKind(item), 'Несоответствие документов, Опасная логистика')
})

test('a bare human review reads as a request for a specialist', () => {
  assert.equal(escalationKind({ title: 'Ручная оценка: HUMAN_REVIEW' }), 'Нужна проверка специалиста')
  assert.equal(escalationKind({ risks: [{ category: 'HUMAN_REVIEW' }] }), 'Нужна проверка специалиста')
})

test('an unknown code falls back to a Russian word, not the code', () => {
  assert.equal(escalationKind({ risks: [{ category: 'SOMETHING_NEW' }] }), 'Прочее')
})

test('a title written in words is kept', () => {
  assert.equal(escalationKind({ title: 'Не подтверждена идентичность продукта', risks: [] }), 'Не подтверждена идентичность продукта')
})

test('the substance leads, with the card number when the title is missing', () => {
  assert.equal(escalationSubject({ cardTitle: '2-Этилгексанол', cardId: 359 }), '2-Этилгексанол')
  assert.equal(escalationSubject({ cardId: 359 }), 'Карточка #359')
})

test('a card waiting for a specialist opens its escalation', async () => {
  const { escalationTarget } = await import('./escalation.js')
  assert.equal(escalationTarget(333, [{ id: 'ESC-1', status: 'OPEN' }, { id: 'ESC-0', status: 'RESOLVED' }]), '/procurement/escalations/ESC-1')
  assert.equal(escalationTarget(333, [{ id: 'ESC-1', status: 'OPEN' }, { id: 'ESC-2', status: 'IN_REVIEW' }]), '/procurement/escalations?cardId=333')
  assert.equal(escalationTarget(331, [{ id: 'ESC-1', status: 'OPEN' }, { id: 'ESC-2', status: 'OPEN' }, { id: 'ESC-0', status: 'RESOLVED' }]), '/procurement/escalations?cardId=331&status=OPEN')
  assert.equal(escalationTarget(333, [{ id: 'ESC-0', status: 'RESOLVED' }]), '/procurement/requests/333')
  assert.equal(escalationTarget(333), '/procurement/requests/333')
})

test('an escalation filed under OTHER is described by its reason', () => {
  const item = {
    title: 'Ручная оценка: OTHER',
    risks: [{ category: 'OTHER', reason: 'Сообщение поставщику подготовлено и ожидает подтверждения специалиста. Дальше текст.' }],
  }
  assert.equal(escalationKind(item), 'Сообщение поставщику подготовлено и ожидает подтверждения специалиста')
  assert.equal(escalationKind({ title: 'Ручная оценка: OTHER', risks: [{ category: 'OTHER' }] }), 'Прочее')
})
