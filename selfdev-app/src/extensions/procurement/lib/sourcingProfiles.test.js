import test from 'node:test'
import assert from 'node:assert/strict'

import { multipliedBySynonyms, profileOfPlan, profileSettings, planProfile, profileNameProblem, effectiveSourcing, profileChanges, profileSummary } from './sourcingProfiles.js'

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

test('a profile that is gone falls back to the default one', () => {
  const settings = {
    defaultProfileId: 'production',
    profiles: [{ id: 'production', templates: [{ id: 'a', enabled: true }], defaultTemplates: [] }],
  }
  assert.equal(profileSettings(settings, 'QP-GONE').profileId, 'production')
})

test('a plan whose profile was deleted reopens on the default and says so', () => {
  const profiles = [{ id: 'laboratory' }]
  assert.deepEqual(planProfile({ queryProfileId: 'laboratory' }, profiles), { profileId: 'laboratory', deleted: false })
  assert.deepEqual(planProfile({ queryProfileId: 'QP-GONE' }, profiles), { profileId: null, deleted: true })
  assert.deepEqual(planProfile({ queryTemplateIds: ['a'] }, profiles), { profileId: null, deleted: true })
  assert.deepEqual(planProfile({}, profiles), { profileId: null, deleted: false })
  assert.deepEqual(planProfile({ queryProfileId: 'QP-GONE' }, []), { profileId: 'QP-GONE', deleted: false })
})

test('a profile name must be present, short and not taken', () => {
  const profiles = [{ id: 'a', name: 'Лаборатория' }]
  assert.match(profileNameProblem('   ', profiles), /Укажите/)
  assert.match(profileNameProblem('я'.repeat(61), profiles), /длиннее/)
  assert.match(profileNameProblem(' лаборатория ', profiles), /уже есть/)
  assert.equal(profileNameProblem('ЛАБОРАТОРИЯ', profiles, 'a'), null)
  assert.equal(profileNameProblem('Пилот', profiles), null)
})

const laboratory = {
  templates: [{ id: 'R', template: '{name} купить' }, { id: 'S', template: '{cas} реактив купить' }],
  defaultQueryIds: ['R', 'S'],
  synonymLimit: 0,
  availableEngineIds: ['brave', 'ddgs', 'echemi'],
  engineList: [{ id: 'brave', label: 'Brave' }, { id: 'ddgs', label: 'DuckDuckGo' }, { id: 'echemi', label: 'Echemi' }, { id: 'openserp', label: 'OpenSERP' }],
  profileValues: { depth: 'NORMAL', engineIds: ['brave', 'ddgs'], siteProbe: false, synonymLimit: 0 },
}

test('a launch follows its profile until it chooses otherwise', () => {
  assert.deepEqual(effectiveSourcing({}, laboratory), {
    depth: 'NORMAL', siteProbe: false, engineIds: ['brave', 'ddgs'], queryIds: ['R', 'S'], synonymLimit: 0,
  })
  const own = effectiveSourcing({ depth: 'MAX', siteProbe: true, engineIds: ['echemi'], queryIds: ['R'], synonymLimit: 2 }, laboratory)
  assert.deepEqual(own, { depth: 'MAX', siteProbe: true, engineIds: ['echemi'], queryIds: ['R'], synonymLimit: 2 })
})

test('a profile with every source follows what the installation has', () => {
  const all = { ...laboratory, profileValues: { ...laboratory.profileValues, engineIds: null } }
  assert.deepEqual(effectiveSourcing({}, all).engineIds, ['brave', 'ddgs', 'echemi'])
})

test('only what differs from the profile is offered for saving', () => {
  const value = { profileDepth: true }
  assert.deepEqual(profileChanges(value, laboratory), {})
  assert.deepEqual(profileChanges({ ...value, depth: 'NORMAL', siteProbe: false, engineIds: ['ddgs', 'brave'] }, laboratory), {})
  assert.deepEqual(profileChanges({ ...value, depth: 'MAX', siteProbe: true, engineIds: ['brave'] }, laboratory), {
    depth: 'MAX', siteProbe: true, engineIds: ['brave'],
  })
  // Unchecked queries are this run's alone.
  assert.deepEqual(profileChanges({ ...value, queryIds: ['R'] }, laboratory), {})
  // The card page's quick look is not a change to the profile.
  assert.deepEqual(profileChanges({ depth: 'FAST', profileDepth: false }, laboratory), {})
})

test('the summary says what this launch will do', () => {
  assert.deepEqual(profileSummary({}, laboratory), [
    '2 запроса, поиск по России', 'Brave, DuckDuckGo', 'глубина «Обычный»', 'сайт не проверяем',
  ])
  assert.equal(profileSummary({ queryIds: ['R'] }, laboratory)[0], '1 из 2 запросов, поиск по России')
  const gone = { ...laboratory, profileValues: { ...laboratory.profileValues, engineIds: ['brave', 'openserp'] } }
  assert.deepEqual(profileSummary({}, gone).slice(1, 2), ['Brave'])
  assert.equal(profileSummary({}, gone).at(-1), 'недоступно: OpenSERP')
  const none = { ...laboratory, availableEngineIds: [] }
  assert.equal(profileSummary({}, none)[1], 'нет доступных источников')
  const world = { ...laboratory, templates: [{ id: 'P', template: '"{cas}" plant' }], defaultQueryIds: ['P'] }
  assert.equal(profileSummary({}, world)[0], '1 запрос, поиск по миру')
})
