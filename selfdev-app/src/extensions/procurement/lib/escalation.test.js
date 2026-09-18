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
