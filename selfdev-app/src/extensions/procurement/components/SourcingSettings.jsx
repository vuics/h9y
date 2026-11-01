import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import {
  DEPTHS,
  RATINGS,
  effectiveSourcing,
  multipliedBySynonyms,
  planProfile,
  plural,
  profileChanges,
  profileSummary,
} from '../lib/sourcingProfiles'
import { Button } from '@/components/ui/button'
import { EnginePicker } from './EnginePicker'
import { ChevronDown, ChevronRight } from './icons'
import { QueryPlanPanel } from './QueryPlanPanel'
import { QueryProfileBar } from './QueryProfileBar'

/** The settings a search runs with — the same ones for one card and for two hundred.
 *
 * Extracted from the single-card page rather than copied beside it. Which
 * engines are used, which queries are issued and whether a candidate's own
 * site is read decide what a result means; a batch that quietly searched with
 * a different set would produce a table nobody could compare with the cards
 * researched by hand. Sharing the component is what makes the two identical
 * by construction instead of by intention.
 *
 * Owns no state of its own: the caller holds `value` and receives `onChange`,
 * because the launch payload is assembled differently on each screen while
 * these fields must not be.
 */

/** How deep each query goes, as a choice rather than a number.
 *
 * The setting used to be "Лимит результатов", a single number that meant two
 * things at once: how many results each query asks each engine for, and how
 * many sources the run will fetch and analyse in total. It was neither — 100
 * did not mean a hundred of anything the reader could point at — and the
 * caption under it did not rescue it.
 *
 * So depth is stated in the unit that is actually capped: results per query.
 * Two to ten is the backend's own clamp, so every value here is one the run can
 * really honour, and the analysis budget follows from it and the number of
 * queries. Breadth is the query plan below; depth is this. Two levers, and each
 * one means what it says.
 */
const depthOf = id => DEPTHS.find(item => item.id === id) || DEPTHS[1]

/** The analysis budget one substance gets: depth spread over the queries.
 *
 * Mirrors the backend, which shares the number back out over the query plan and
 * clamps the result — so sending the product of the two is what makes the
 * chosen depth the depth actually used.
 */
export const sourcesPerSubstance = (depth, queryCount, ceiling = 300) =>
  Math.max(1, Math.min(ceiling, depthOf(depth).perQuery * Math.max(1, queryCount)))

/** How many queries the plan really issues, synonym repeats included.
 *
 * A query written with `{name}` is issued once for the card's own name and once
 * more for each of the substance's other names, so the number of lines in the
 * plan is not the number of searches. This is the upper bound — a substance
 * whose normalization offers fewer usable names issues fewer — and the bound is
 * the right end to err on: the analysis budget is spread over the queries, so
 * budgeting for the shorter plan would quietly cut the chosen depth.
 */
export const effectiveQueryCount = (templates, selectedIds, synonymLimit = 0) => {
  const selected = templates.filter(item => selectedIds.includes(item.id))
  const byName = selected.filter(item => multipliedBySynonyms(item.template)).length
  return selected.length + byName * Math.max(0, synonymLimit)
}

const duration = seconds => {
  const minutes = seconds / 60
  if (minutes < 90) return `${Math.max(1, Math.round(minutes))} мин`
  const hours = minutes / 60
  return hours < 48 ? `${Math.round(hours)} ч` : `${Math.round(hours / 24)} сут`
}

// Mirrors the backend's own default (`PROCUREMENT_CAMPAIGN_CONCURRENCY`): two
// substances are searched at once, so a campaign's wall-clock is the total work
// halved. Wrong only if a deployment has retuned it, and wrong in the direction
// that under-promises.
const CAMPAIGN_CONCURRENCY = 2

/** Everything the settings need from the server, fetched once per screen. */
export function useSourcingSettings() {
  const queryClient = useQueryClient()
  const queryTemplates = useQuery({
    queryKey: procurementKeys.sourcingQueryTemplates(),
    queryFn: ({ signal }) => procurementApi.sourcingQueryTemplates(signal),
  })
  const engines = useQuery({
    queryKey: procurementKeys.sourcingEngines(),
    queryFn: ({ signal }) => procurementApi.sourcingEngines(signal),
  })
  const saveTemplates = useMutation({
    mutationFn: payload => procurementApi.saveSourcingQueryTemplates(payload),
    onSuccess: data => queryClient.setQueryData(procurementKeys.sourcingQueryTemplates(), data),
  })
  const profileMutation = mutationFn => ({
    mutationFn,
    onSuccess: data => queryClient.setQueryData(procurementKeys.sourcingQueryTemplates(), data),
  })
  const saveDefaultProfile = useMutation(profileMutation(profileId => procurementApi.saveDefaultQueryProfile(profileId)))
  const createProfile = useMutation(profileMutation(payload => procurementApi.createQueryProfile(payload)))
  const updateProfile = useMutation(profileMutation(({ profileId, ...fields }) => procurementApi.updateQueryProfile(profileId, fields)))
  const deleteProfile = useMutation(profileMutation(profileId => procurementApi.deleteQueryProfile(profileId)))
  const templates = queryTemplates.data?.templates || []
  const engineList = engines.data?.engines || []
  const availableEngineIds = engineList.filter(item => item.available).map(item => item.id)
  return {
    templates,
    engineList,
    availableEngineIds,
    secondsPerSource: engines.data?.analysisSecondsPerSource ?? null,
    maxAnalysedSources: engines.data?.maxAnalysedSources ?? 300,
    defaultQueryIds: templates.filter(item => item.enabled).map(item => item.id),
    isDefault: queryTemplates.data?.isDefault,
    defaultTemplates: queryTemplates.data?.defaultTemplates || [],
    synonymLimit: queryTemplates.data?.synonymLimit ?? 0,
    defaultSynonymLimit: queryTemplates.data?.defaultSynonymLimit ?? 3,
    maxSynonymLimit: queryTemplates.data?.maxSynonymLimit ?? 10,
    profiles: queryTemplates.data?.profiles || [],
    defaultProfileId: queryTemplates.data?.defaultProfileId ?? null,
    saveTemplates,
    saveDefaultProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    isLoading: queryTemplates.isLoading || engines.isLoading,
  }
}

export function SourcingSettings({
  settings,
  value,
  onChange,
  disabled,
  canEdit,
  cas,
  substanceName,
  onTemplatesSaved,
  substanceCount,
}) {
  const { templates, engineList, saveTemplates } = settings
  const [open, setOpen] = useState(false)
  const current = effectiveSourcing(value, settings)
  const { queryIds, engineIds } = current
  const patch = fields => onChange({ ...value, ...fields })
  // The settings that follow the profile, cleared so they follow another or a
  // saved one. The depth stays where this form does not take it from the profile.
  const followProfile = { engineIds: null, siteProbe: null, synonymLimit: null, ratingMode: null, ...(value.profileDepth ? { depth: null } : {}) }
  const changes = profileChanges(value, settings)
  const changed = Object.keys(changes).length > 0

  return <section className="pr-profile-frame">
    {settings.profiles.length > 0 && <QueryProfileBar
      settings={settings}
      canEdit={canEdit}
      disabled={disabled}
      planProfileDeleted={value.planProfileDeleted}
      // The selection belongs to the list it was made in.
      onSelect={profileId => patch({ ...followProfile, profileId, queryIds: null, planProfileDeleted: false })}
    />}
    <button type="button" className="pr-profile-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <span>
        {profileSummary(value, settings).join(' · ')}
        {changed && <em> · изменено для этого запуска</em>}
      </span>
      <b>{open ? 'Скрыть настройки' : 'Показать настройки'}</b>
    </button>
    <p className="pr-note pr-sourcing-cost-note">
      {(() => {
        const queryCount = effectiveQueryCount(templates, queryIds, current.synonymLimit)
        const perSubstance = sourcesPerSubstance(current.depth, queryCount, settings.maxAnalysedSources)
        const count = Math.max(1, substanceCount || 1)
        const total = perSubstance * count
        const rate = settings.secondsPerSource
        return <>
          до {queryCount} {plural(queryCount, 'запроса', 'запросов', 'запросов')} × {depthOf(current.depth).perQuery} = до {perSubstance} {plural(perSubstance, 'источника', 'источников', 'источников')} на вещество
          {count > 1 && <>, около {total.toLocaleString('ru-RU')} на всю закупку</>}.
          {' '}Каждый источник — одно скачивание страницы и одно обращение к модели.
          {rate
            ? <> Ориентировочно {duration(total * rate / (count > 1 ? CAMPAIGN_CONCURRENCY : 1))} по скорости последних прогонов этой установки.</>
            : <> Времени пока не по чему оценить — эта установка ещё не завершила ни одного поиска.</>}
        </>
      })()}
    </p>
    {open && <div className="pr-profile-settings">
      <QueryPlanPanel
        // Another profile is another list: an open editor must not carry over.
        key={settings.profileId}
        templates={templates}
        isDefault={settings.isDefault}
        selectedIds={queryIds}
        onSelectionChange={(id, checked) => patch({
          queryIds: checked
            ? [...new Set([...queryIds, id])]
            : queryIds.filter(item => item !== id),
        })}
        onSave={async (payload, synonymLimit) => {
          try {
            await saveTemplates.mutateAsync({ templates: payload, synonymLimit, profileId: settings.profileId })
            patch({ synonymLimit: null })
            onTemplatesSaved?.()
            return true
          } catch { return false }
        }}
        // A profile made here has no stock list to go back to.
        onReset={settings.defaultTemplates.length ? () => saveTemplates.mutate({
          templates: settings.defaultTemplates.map(template => ({ template, enabled: true })),
          profileId: settings.profileId,
        }) : undefined}
        isSaving={saveTemplates.isPending}
        saveError={saveTemplates.error}
        canEdit={canEdit}
        disabled={disabled}
        cas={cas}
        substanceName={substanceName}
        synonymLimit={current.synonymLimit}
        maxSynonymLimit={settings.maxSynonymLimit}
      />
      <EnginePicker
        engines={engineList}
        selectedIds={engineIds}
        disabled={disabled}
        onToggle={(id, checked) => patch({
          engineIds: checked
            ? [...new Set([...engineIds, id])]
            : engineIds.filter(item => item !== id),
        })}
      />
      <fieldset className="pr-depth-picker">
        <legend>Глубина поиска</legend>
        {!value.profileDepth && <p className="pr-query-profile-note">Поиск по одной карточке по умолчанию быстрый: глубина здесь не берётся из профиля.</p>}
        {DEPTHS.map(depth => <label key={depth.id} className={current.depth === depth.id ? 'is-selected' : undefined}>
          <input
            type="radio"
            name="sourcing-depth"
            aria-label={`Глубина: ${depth.label}`}
            checked={current.depth === depth.id}
            disabled={disabled}
            onChange={() => patch({ depth: depth.id })}
          />
          <span><strong>{depth.label}</strong>{depth.detail}</span>
        </label>)}
      </fieldset>
      <label className="pr-sourcing-probe">
        <input
          type="checkbox"
          checked={current.siteProbe}
          onChange={event => patch({ siteProbe: event.target.checked })}
          disabled={disabled}
        />
        <span>
          <strong>Проверять сайт кандидата</strong>
          Открывать каталог и страницу «О компании» у тех, кто заявил производство: каталог на тысячи веществ и описание вида «поставщик аналитических стандартов» видны только там. Читается правилами, без обращения к модели.
        </span>
      </label>
      <fieldset className="pr-depth-picker">
        <legend>Как оценивать кандидатов</legend>
        {RATINGS.map(rating => <label key={rating.id} className={current.ratingMode === rating.id ? 'is-selected' : undefined}>
          <input
            type="radio"
            name="sourcing-rating"
            aria-label={`Рейтинг: ${rating.label}`}
            checked={current.ratingMode === rating.id}
            disabled={disabled}
            onChange={() => patch({ ratingMode: rating.id })}
          />
          <span><strong>{rating.label}</strong>{rating.detail}</span>
        </label>)}
      </fieldset>
      {changed && <div className="pr-query-profile-form">
        <p className="pr-query-profile-note">Эти изменения пока относятся только к этому запуску.</p>
        {canEdit && settings.profileId && <Button
          variant="outline"
          size="sm"
          isDisabled={disabled || settings.updateProfile.isPending}
          onPress={() => settings.updateProfile.mutate(
            { profileId: settings.profileId, ...changes },
            { onSuccess: () => patch(followProfile) },
          )}
        >Сохранить в профиле</Button>}
        <Button variant="ghost" size="sm" isDisabled={disabled} onPress={() => patch(followProfile)}>Вернуть как в профиле</Button>
        {settings.updateProfile.error && !settings.updateProfile.isPending && <small className="pr-import-missing" role="alert">Настройки профиля не сохранены.</small>}
      </div>}
    </div>}
  </section>
}

/** Whether the settings can produce a run at all. */
export const canLaunch = (settings, value) => {
  const { queryIds, engineIds } = effectiveSourcing(value, settings)
  return queryIds.length > 0 && engineIds.length > 0
}

/** Starting settings: a purchase follows its profile.
 *
 * A single card does not take the profile's depth: it is usually a look, and a
 * look should be quick.
 */
export const defaultSourcingValue = ({ campaign = false } = {}) => ({
  depth: campaign ? null : 'FAST',
  profileDepth: campaign,
  siteProbe: null,
  engineIds: null,
  queryIds: null,
  synonymLimit: null,
  ratingMode: null,
  profileId: null,
  planProfileDeleted: false,
})

/** The panel's value for a plan already stored on a campaign.
 *
 * The plan keeps the analysis budget, not the depth it came from; the depth is
 * the one whose per-query count, spread over the plan's queries, is nearest.
 */
export const sourcingValueFromPlan = (plan, settings) => {
  const profile = planProfile(plan, settings.profiles)
  const queryCount = Math.max(1, (plan?.queryTemplateIds ?? settings.defaultQueryIds).length)
  const perQuery = (plan?.maxResults || 0) / queryCount
  const depth = DEPTHS.reduce((best, item) =>
    Math.abs(item.perQuery - perQuery) < Math.abs(best.perQuery - perQuery) ? item : best).id
  return {
    depth,
    profileDepth: true,
    siteProbe: plan?.siteProbe ?? null,
    engineIds: plan?.engineIds ?? null,
    synonymLimit: plan?.synonymLimit ?? null,
    ratingMode: plan?.ratingMode ?? null,
    queryIds: profile.deleted ? null : plan?.queryTemplateIds ?? null,
    profileId: profile.profileId,
    planProfileDeleted: profile.deleted,
  }
}

/** The depth a run was actually started with, or null when it cannot be told.
 *
 * From the budget it stored, spread over its queries; for a run started before
 * the budget was stored, from the most results any one query returned on one
 * engine, which the depth caps (2, 5, 10).
 */
export const depthOfRun = run => {
  if (!run) return null
  const queries = Math.max(1, run.queryPlan?.length || 0)
  let perQuery = run.maxResults ? run.maxResults / queries : 0
  if (!perQuery && run.sources?.length) {
    const counts = {}
    for (const source of run.sources) {
      const key = `${source.query}|${source.engine}`
      counts[key] = (counts[key] || 0) + 1
    }
    perQuery = Math.max(...Object.values(counts))
    if (perQuery > 5) perQuery = 10
    else if (perQuery > 2) perQuery = 5
  }
  if (!perQuery) return null
  return DEPTHS.reduce((best, item) =>
    Math.abs(item.perQuery - perQuery) < Math.abs(best.perQuery - perQuery) ? item : best)
}

export { plural }
