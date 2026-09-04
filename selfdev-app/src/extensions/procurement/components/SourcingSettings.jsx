import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { EnginePicker } from './EnginePicker'
import { QueryPlanPanel } from './QueryPlanPanel'

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
const DEPTHS = [
  { id: 'FAST', perQuery: 2, label: 'Быстрый', detail: 'По 2 результата на запрос — хватает, чтобы увидеть, есть ли вообще кто-то.' },
  { id: 'NORMAL', perQuery: 5, label: 'Обычный', detail: 'По 5 на запрос. Разумный выбор для кампании по длинному списку.' },
  { id: 'MAX', perQuery: 10, label: 'Максимальный', detail: 'По 10 — это потолок, выше поисковые движки не отдают.' },
]

const DEFAULT_DEPTH = 'NORMAL'

const depthOf = id => DEPTHS.find(item => item.id === id) || DEPTHS[1]

/** The analysis budget one substance gets: depth spread over the queries.
 *
 * Mirrors the backend, which shares the number back out over the query plan and
 * clamps the result — so sending the product of the two is what makes the
 * chosen depth the depth actually used.
 */
export const sourcesPerSubstance = (depth, queryCount, ceiling = 300) =>
  Math.max(1, Math.min(ceiling, depthOf(depth).perQuery * Math.max(1, queryCount)))

const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
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
    saveTemplates,
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
  const { templates, engineList, availableEngineIds, defaultQueryIds, saveTemplates } = settings
  const queryIds = (value.queryIds ?? defaultQueryIds)
  const engineIds = (value.engineIds ?? availableEngineIds).filter(id => availableEngineIds.includes(id))
  const patch = fields => onChange({ ...value, ...fields })

  return <>
    <label className="pr-sourcing-probe">
      <input
        type="checkbox"
        checked={value.siteProbe}
        onChange={event => patch({ siteProbe: event.target.checked })}
        disabled={disabled}
      />
      <span>
        <strong>Проверять сайт кандидата</strong>
        Открывать каталог и страницу «О компании» у тех, кто заявил производство: каталог на тысячи веществ и описание вида «поставщик аналитических стандартов» видны только там. Читается правилами, без обращения к модели.
      </span>
    </label>
    <fieldset className="pr-depth-picker">
      <legend>Глубина поиска</legend>
      {DEPTHS.map(depth => <label key={depth.id} className={value.depth === depth.id ? 'is-selected' : undefined}>
        <input
          type="radio"
          name="sourcing-depth"
          aria-label={`Глубина: ${depth.label}`}
          checked={value.depth === depth.id}
          disabled={disabled}
          onChange={() => patch({ depth: depth.id })}
        />
        <span><strong>{depth.label}</strong>{depth.detail}</span>
      </label>)}
    </fieldset>
    <p className="pr-note pr-sourcing-cost-note">
      {(() => {
        const perSubstance = sourcesPerSubstance(value.depth, queryIds.length, settings.maxAnalysedSources)
        const count = Math.max(1, substanceCount || 1)
        const total = perSubstance * count
        const rate = settings.secondsPerSource
        return <>
          {queryIds.length} {plural(queryIds.length, 'запрос', 'запроса', 'запросов')} × {depthOf(value.depth).perQuery} = до {perSubstance} {plural(perSubstance, 'источника', 'источников', 'источников')} на вещество
          {count > 1 && <>, около {total.toLocaleString('ru-RU')} на всю кампанию</>}.
          {' '}Каждый источник — одно скачивание страницы и одно обращение к модели.
          {rate
            ? <> Ориентировочно {duration(total * rate / (count > 1 ? CAMPAIGN_CONCURRENCY : 1))} по скорости последних прогонов этой установки.</>
            : <> Времени пока не по чему оценить — эта установка ещё не завершила ни одного поиска.</>}
        </>
      })()}
    </p>
    <EnginePicker
      engines={engineList}
      selectedIds={engineIds}
      disabled={disabled}
      onToggle={(id, checked) => patch({
        engineIds: checked
          ? [...new Set([...engineIds, id])]
          : engineIds.filter(current => current !== id),
      })}
    />
    <QueryPlanPanel
      templates={templates}
      isDefault={settings.isDefault}
      selectedIds={queryIds}
      onSelectionChange={(id, checked) => patch({
        queryIds: checked
          ? [...new Set([...queryIds, id])]
          : queryIds.filter(current => current !== id),
      })}
      onSave={async payload => {
        try {
          await saveTemplates.mutateAsync(payload)
          onTemplatesSaved?.()
          return true
        } catch { return false }
      }}
      onReset={() => saveTemplates.mutate(settings.defaultTemplates.map(template => ({ template, enabled: true })))}
      isSaving={saveTemplates.isPending}
      saveError={saveTemplates.error}
      canEdit={canEdit}
      disabled={disabled}
      cas={cas}
      substanceName={substanceName}
    />
  </>
}

/** Whether the settings can produce a run at all. */
export const canLaunch = (settings, value) =>
  (value.queryIds ?? settings.defaultQueryIds).length > 0 &&
  (value.engineIds ?? settings.availableEngineIds).filter(id => settings.availableEngineIds.includes(id)).length > 0

/** Starting settings.
 *
 * A campaign defaults wider than a single card: it is launched once and left,
 * so it trades breadth against wall-clock rather than against the operator's
 * attention. The backend's own campaign default matches this number.
 */
export const defaultSourcingValue = ({ campaign = false } = {}) => ({
  // A campaign goes deeper by default: it is launched once and left, so it
  // trades depth against wall-clock rather than against the operator's
  // attention. A single card is usually a look, and a look should be quick.
  depth: campaign ? DEFAULT_DEPTH : 'FAST',
  siteProbe: true,
  engineIds: null,
  queryIds: null,
})

export { plural }
