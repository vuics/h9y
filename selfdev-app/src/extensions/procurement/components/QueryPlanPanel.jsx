import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CircleAlert, Plus, Sliders, Trash } from './icons'

const renderQuery = (template, cas, name) =>
  String(template || '')
    .replaceAll('{cas}', cas || '{cas}')
    .replaceAll('{name}', name || '{name}')

const messageOf = error => error?.response?.data?.message || error?.message

export function QueryPlanPanel({
  templates = [],
  isDefault,
  selectedIds,
  onSelectionChange,
  onSave,
  onReset,
  isSaving,
  saveError,
  canEdit,
  disabled,
  cas,
  substanceName,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState([])

  useEffect(() => {
    if (!isEditing) setDraft(templates.map(item => ({ ...item })))
  }, [templates, isEditing])

  const startEditing = () => {
    setDraft(templates.map(item => ({ ...item })))
    setIsEditing(true)
  }
  const cancelEditing = () => {
    setDraft(templates.map(item => ({ ...item })))
    setIsEditing(false)
  }
  const updateDraft = (index, patch) =>
    setDraft(current => current.map((item, position) => position === index ? { ...item, ...patch } : item))
  const removeDraft = index => setDraft(current => current.filter((_, position) => position !== index))
  const addDraft = () => setDraft(current => [...current, { id: `new-${current.length}-${Date.now()}`, template: '"{cas}" ', enabled: true }])

  const submit = async event => {
    event.preventDefault()
    const payload = draft
      .map(item => ({ template: item.template.trim(), enabled: Boolean(item.enabled) }))
      .filter(item => item.template)
    if (!payload.length) return
    const saved = await onSave(payload)
    if (saved) setIsEditing(false)
  }

  const rows = isEditing ? draft : templates
  const selectedCount = templates.filter(item => selectedIds.includes(item.id)).length

  return (
    <section className="pr-query-plan">
      <header>
        <div>
          <strong>Поисковые запросы</strong>
          <span>
            {isEditing
              ? 'Галочка задаёт, входит ли запрос в план по умолчанию. Список общий для всех карточек.'
              : `В этот запуск войдёт ${selectedCount} из ${templates.length}. Снятая галочка не меняет общий список.`}
          </span>
        </div>
        {!isEditing && canEdit && (
          <Button variant="outline" size="sm" isDisabled={disabled} onPress={startEditing}>
            <Sliders size={14} />Настроить запросы
          </Button>
        )}
      </header>

      {saveError && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Запросы не сохранены</AlertTitle>
          <AlertDescription>{messageOf(saveError)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit}>
        <ol className="pr-query-plan__list">
          {rows.map((item, index) => {
            const checked = isEditing ? Boolean(item.enabled) : selectedIds.includes(item.id)
            return (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled && !isEditing}
                    onChange={event => isEditing
                      ? updateDraft(index, { enabled: event.target.checked })
                      : onSelectionChange(item.id, event.target.checked)}
                  />
                  <span className="pr-visually-hidden">
                    {isEditing ? 'Включить запрос в план по умолчанию' : 'Использовать запрос в этом запуске'}
                  </span>
                </label>
                {isEditing ? (
                  <Input
                    value={item.template}
                    aria-label={`Поисковый запрос ${index + 1}`}
                    onChange={event => updateDraft(index, { template: event.target.value })}
                  />
                ) : (
                  <div className="pr-query-plan__query">
                    <code>{item.template}</code>
                    <small>{renderQuery(item.template, cas, substanceName)}</small>
                  </div>
                )}
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={draft.length <= 1}
                    onPress={() => removeDraft(index)}
                    aria-label={`Удалить запрос ${index + 1}`}
                  >
                    <Trash size={14} />
                  </Button>
                )}
              </li>
            )
          })}
        </ol>

        {isEditing && (
          <div className="pr-query-plan__editor-actions">
            <Button variant="ghost" size="sm" onPress={addDraft}><Plus size={14} />Добавить запрос</Button>
            <p className="pr-note">
              Доступные переменные: <code>{'{cas}'}</code> и <code>{'{name}'}</code>. Каждый запрос должен использовать
              хотя бы одну — иначе все карточки искали бы одно и то же.
            </p>
            <div className="pr-inline-actions">
              {!isDefault && <Button variant="ghost" size="sm" isDisabled={isSaving} onPress={onReset}>Вернуть стандартные</Button>}
              <Button variant="outline" isDisabled={isSaving} onPress={cancelEditing}>Отмена</Button>
              <Button type="submit" isDisabled={isSaving}>{isSaving ? 'Сохранение…' : 'Сохранить для всех карточек'}</Button>
            </div>
          </div>
        )}
      </form>
    </section>
  )
}
