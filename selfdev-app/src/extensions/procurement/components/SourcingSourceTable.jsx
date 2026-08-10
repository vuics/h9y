import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge, statusLabel } from './StatusBadge'
import { EmptyState } from './AsyncState'
import { ExternalLink, RotateBack } from './icons'

// Why a source produced nothing, in the specialist's language rather than a code.
const statusHints = {
  ANALYZED: 'Источник прочитан, цитаты сохранены.',
  NO_EVIDENCE: 'Источник прочитан, но подтверждающих утверждений о компании в нём нет.',
  OFF_SUBJECT: 'Страница не упоминает нужный CAS или название — вероятно, выдача промахнулась либо сайт отдал заглушку.',
  EXTRACTION_TIMEOUT: 'Модель не успела разобрать источник за отведённое время.',
  EXTRACTION_FAILED: 'Модель вернула ошибку при разборе источника.',
  BUDGET_EXHAUSTED: 'Общий бюджет прогона закончился раньше, чем дошла очередь до этого источника.',
  PENDING: 'Источник найден, но ещё не разобран.',
}

const warningHints = {
  page_unusable_using_search_snippet: 'Страница недоступна для чтения — разобран сниппет выдачи.',
  extraction_fell_back_to_search_snippet: 'Полный текст не разобрался — использован сниппет выдачи.',
  skipped_no_subject_match: 'Пропущен как нерелевантный.',
  country_removed_without_exact_evidence: 'Страна отброшена: не нашлось точной цитаты.',
}

const describeWarning = warning => {
  if (warningHints[warning]) return warningHints[warning]
  if (warning.startsWith('fetch_failed:')) return 'Страницу не удалось скачать.'
  if (warning.startsWith('ungrounded_claim_removed:')) return 'Утверждение отброшено: цитаты нет в источнике.'
  if (warning.startsWith('extraction_failed:')) return null
  return warning
}

const filters = [
  ['ALL', 'Все'],
  ['ANALYZED', 'С доказательствами'],
  ['PROBLEM', 'Требуют внимания'],
  ['OFF_SUBJECT', 'Нерелевантные'],
]

// "Требуют внимания" means the analysis broke, not that the page was irrelevant.
const isProblem = source => ['EXTRACTION_TIMEOUT', 'EXTRACTION_FAILED', 'BUDGET_EXHAUSTED'].includes(source.status)

export function SourcingSourceTable({ sources = [], onRetry, retryingId, canRetry, isRunning }) {
  const [filter, setFilter] = useState('ALL')

  const visible = useMemo(() => sources.filter(source => {
    if (filter === 'ALL') return true
    if (filter === 'ANALYZED') return source.status === 'ANALYZED'
    if (filter === 'OFF_SUBJECT') return source.status === 'OFF_SUBJECT'
    return isProblem(source)
  }), [sources, filter])

  const retryable = sources.filter(isProblem)

  if (!sources.length) return <EmptyState title={isRunning ? 'Источники обрабатываются' : 'Источники не сохранены'} />

  return (
    <div className="pr-source-table">
      <div className="pr-source-table__filters" role="group" aria-label="Фильтр источников">
        {filters.map(([value, label]) => {
          const count = value === 'ALL'
            ? sources.length
            : value === 'PROBLEM'
              ? retryable.length
              : sources.filter(source => source.status === value).length
          return (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : ''}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}<b>{count}</b>
            </button>
          )
        })}
      </div>

      {!visible.length ? <EmptyState title="Нет источников в этой группе" /> : (
        <div className="pr-source-table__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Источник</th>
                <th scope="col">Тип</th>
                <th scope="col">Статус</th>
                <th scope="col">Цитаты</th>
                <th scope="col"><span className="pr-visually-hidden">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(source => {
                const href = source.finalUrl || source.url
                const notes = (source.extractionWarnings || []).map(describeWarning).filter(Boolean)
                return (
                  <tr key={source.id} className={`is-${source.status?.toLowerCase()}`}>
                    <th scope="row">
                      <a href={href} target="_blank" rel="noreferrer" title={href}>
                        {source.domain || href}<ExternalLink size={12} />
                      </a>
                      <span title={source.title}>{source.title || 'Без заголовка'}</span>
                      {source.query && <code title="Запрос, который нашёл источник">{source.query}</code>}
                    </th>
                    <td><StatusBadge status={source.sourceType} compact /></td>
                    <td>
                      <StatusBadge status={source.status} compact />
                      <small>{statusHints[source.status] || statusLabel(source.status)}</small>
                      {notes.map((note, index) => <small key={index} className="is-note">{note}</small>)}
                    </td>
                    <td className="pr-source-table__claims">
                      <b>{source.claimCount || 0}</b>
                    </td>
                    <td className="pr-source-table__actions">
                      {source.retryable && canRetry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled={isRunning || Boolean(retryingId)}
                          onPress={() => onRetry(source.id)}
                        >
                          <RotateBack size={14} className={retryingId === source.id ? 'pr-spin' : undefined} />
                          {retryingId === source.id ? 'Разбираем…' : 'Разобрать снова'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
