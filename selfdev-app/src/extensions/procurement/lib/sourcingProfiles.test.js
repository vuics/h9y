import test from 'node:test'
import assert from 'node:assert/strict'

import { multipliedBySynonyms, profileOfPlan, profileSettings } from './sourcingProfiles.js'

const settings = {
  defaultProfileId: 'production',
  templates: [{ id: 'P', template: '"{cas}" plant', enabled: true }],
  defaultQueryIds: ['P'],
  profiles: [
    { id: 'production', templates: [{ id: 'P', template: '"{cas}" plant', enabled: true }], isDefault: true, defaultTemplates: ['"{cas}" plant'] },
    { id: 'laboratory', templates: [{ id: 'L', template: '{name} купить', enabled: true }, { id: 'M', template: '{name} цена', enabled: false }], isDefault: false, defaultTemplates: ['{name} купить'] },
  ],
}

test('the list of queries follows the chosen profile, and only its enabled ones are preselected', () => {
  const chosen = profileSettings(settings, 'laboratory')
  assert.equal(chosen.profileId, 'laboratory')
  assert.deepEqual(chosen.templates.map(item => item.id), ['L', 'M'])
  assert.deepEqual(chosen.defaultQueryIds, ['L'])
  assert.equal(chosen.isDefault, false)
})

test('no choice means the default profile', () => {
  assert.equal(profileSettings(settings, null).profileId, 'production')
})

test('a server without profiles keeps the single list', () => {
  const old = { templates: [{ id: 'P' }], defaultQueryIds: ['P'] }
  assert.equal(profileSettings(old, null), old)
})

test('a plan saved before profiles reopens on production, and a plan with none on the default', () => {
  assert.equal(profileOfPlan({ queryProfileId: 'laboratory', queryTemplateIds: ['L'] }), 'laboratory')
  assert.equal(profileOfPlan({ queryTemplateIds: ['P'] }), 'production')
  assert.equal(profileOfPlan({}), null)
})

test('a Russian query is not counted as repeated for synonyms', () => {
  assert.equal(multipliedBySynonyms('"{name}" plant'), true)
  assert.equal(multipliedBySynonyms('{name} купить'), false)
  assert.equal(multipliedBySynonyms('"{cas}" plant'), false)
})
