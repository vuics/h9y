import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { EnginePicker } from './EnginePicker'
import { QueryPlanPanel } from './QueryPlanPanel'
import { SelectField } from './SelectField'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

const RESULT_LIMITS = ['1', '5', '10', '20', '50', '100']

const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

// Mirrors the backend: the chosen number is a budget shared out over the
// queries, then clamped, so the same choice means different things depending on
// how many queries a run uses. Stating the result stops "10" reading as a
// promise of ten sources when it produces about eighty.
export const perQueryResults = (maxResults, queryCount) =>
  Math.max(2, Math.min(10, Math.ceil(maxResults / queryCount)))

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
    <div className="pr-sourcing-launch__controls">
      <SelectField
        label="Лимит результатов"
        selectedKey={String(value.maxResults)}
        onSelectionChange={selected => patch({ maxResults: String(selected) })}
        isDisabled={disabled}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{RESULT_LIMITS.map(limit => <SelectItem key={limit} id={limit}>{limit}</SelectItem>)}</SelectContent>
      </SelectField>
    </div>
    {queryIds.length > 0 && (() => {
      const per = perQueryResults(Number(value.maxResults), queryIds.length)
      return <p className="pr-note pr-sourcing-limit-note">
        До {per} {plural(per, 'результата', 'результатов', 'результатов')}{queryIds.length === 1 ? ' для единственного запроса' : ` на каждый из ${queryIds.length} ${plural(queryIds.length, 'запроса', 'запросов', 'запросов')}`} — по каждому выбранному движку. Охват растёт от числа запросов, а не от этого лимита.
      </p>
    })()}
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

export const defaultSourcingValue = () => ({
  maxResults: '10',
  siteProbe: true,
  engineIds: null,
  queryIds: null,
})

export { plural }
