import React from 'react'
import { statusLabel } from './StatusBadge'

const stageLabels = {
  DISCOVERY: 'Ищем релевантные открытые источники',
  ANALYSIS: 'Читаем источники и извлекаем доказательства',
  MANUAL_SOURCE: 'Анализируем добавленный источник',
  COMPLETED: 'Поиск завершён',
  FAILED: 'Поиск остановлен',
  INTERRUPTED: 'Прогон прерван',
  CANCELLED: 'Поиск остановлен пользователем',
}

// Ordered so the bar always reads left-to-right from useful to unusable.
const segments = [
  ['ANALYZED', 'good'],
  ['NO_EVIDENCE', 'muted'],
  ['OFF_SUBJECT', 'muted'],
  ['EXTRACTION_TIMEOUT', 'warn'],
  ['BUDGET_EXHAUSTED', 'warn'],
  ['EXTRACTION_FAILED', 'bad'],
  ['PENDING', 'pending'],
]

export function SourcingProgress({ run, isRunning }) {
  const progress = run?.progress || {}
  const counts = progress.sourceStatusCounts || {}
  const discovered = progress.discoveredSources || 0
  const processed = Math.min(progress.processedSources || 0, discovered)
  const total = discovered || run?.sources?.length || 0
  const percent = total ? Math.round((processed / total) * 100) : 0
  const evidence = progress.evidenceSources || 0
  const present = segments.filter(([status]) => counts[status] > 0)

  return (
    <section className={`pr-sourcing-progress${isRunning ? ' is-running' : ''}`} aria-live="polite">
      <header>
        <div>
          <strong>{stageLabels[progress.stage] || (isRunning ? 'Поиск выполняется' : 'Поиск завершён')}</strong>
          <span>
            {total
              ? `Обработано ${processed} из ${total} источников · доказательства найдены в ${evidence}`
              : 'Формируем список источников…'}
          </span>
        </div>
        <b aria-hidden="true">{percent}%</b>
      </header>

      <div
        className="pr-sourcing-progress__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Готовность поиска"
      >
        {total > 0 ? (
          <div className="pr-sourcing-progress__stack">
            {present.map(([status, tone]) => (
              <span
                key={status}
                className={`is-${tone}`}
                style={{ width: `${(counts[status] / total) * 100}%` }}
                title={`${statusLabel(status)}: ${counts[status]}`}
              />
            ))}
          </div>
        ) : (
          <div className="pr-sourcing-progress__indeterminate" />
        )}
      </div>

      {present.length > 0 && (
        <ul className="pr-sourcing-progress__legend">
          {present.map(([status, tone]) => (
            <li key={status}>
              <i className={`is-${tone}`} aria-hidden="true" />
              {statusLabel(status)}
              <b>{counts[status]}</b>
            </li>
          ))}
        </ul>
      )}

      {isRunning && (
        <p className="pr-note">
          Результаты появляются по мере готовности — страницу можно не обновлять и не ждать до конца.
        </p>
      )}
    </section>
  )
}
