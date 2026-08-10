import React from 'react'
import { importStageLabels } from '../api/imports'

// The four stages a specialist actually waits through, in order.
const stages = [
  ['RECOGNIZING', 'Распознавание'],
  ['MAPPING', 'Столбцы'],
  ['CREATING', 'Создание карточек'],
  ['NORMALIZING', 'Сверка с PubChem'],
]

const stageOrder = ['RECOGNIZING', 'MAPPING', 'AWAITING_CONFIRMATION', 'CREATING', 'NORMALIZING', 'DONE']

function detail(run) {
  const progress = run?.progress || {}
  if (progress.stage === 'CREATING') {
    return `Создано ${progress.processedRows} из ${progress.creatableRows} карточек`
  }
  if (progress.stage === 'NORMALIZING') {
    return `Сверено ${progress.normalizedCards} из ${progress.createdCards} карточек`
  }
  if (progress.stage === 'AWAITING_CONFIRMATION') {
    return `Разобрано строк: ${run?.summary?.totalRows ?? 0}. Карточки ещё не созданы.`
  }
  if (run?.status === 'CANCELLED') {
    return `Импорт остановлен. Уже созданные карточки сохранены: ${progress.createdCards}.`
  }
  if (run?.status === 'FAILED') return 'Импорт остановлен ошибкой.'
  if (progress.stage === 'DONE') {
    return `Создано карточек: ${run?.summary?.created ?? 0}, из них черновиков: ${run?.summary?.draftsCreated ?? 0}.`
  }
  return 'Читаем файл и определяем структуру таблицы…'
}

export function ImportProgress({ run }) {
  const progress = run?.progress || {}
  const percent = Math.max(0, Math.min(100, progress.percent ?? 0))
  const currentIndex = stageOrder.indexOf(progress.stage)
  const running = ['ANALYZING', 'CREATING', 'NORMALIZING'].includes(run?.status)
  // An indeterminate bar while recognizing: there is no row count to divide by yet.
  const indeterminate = run?.status === 'ANALYZING' && progress.stage === 'RECOGNIZING'

  return (
    <section className={`pr-import-progress${running ? ' is-running' : ''}`} aria-live="polite">
      <header>
        <div>
          <strong>{importStageLabels[progress.stage] || 'Импорт'}</strong>
          <span>{detail(run)}</span>
        </div>
        {!indeterminate && <b aria-hidden="true">{percent}%</b>}
      </header>

      <div
        className="pr-import-progress__track"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Готовность импорта"
      >
        {indeterminate
          ? <div className="pr-import-progress__indeterminate" />
          : <div className="pr-import-progress__fill" style={{ width: `${percent}%` }} />}
      </div>

      <ol className="pr-import-progress__stages">
        {stages.map(([stage, label]) => {
          const index = stageOrder.indexOf(stage)
          const done = progress.stage === 'DONE' ? true : index < currentIndex
          const active = stage === progress.stage
          return (
            <li key={stage} className={active ? 'is-active' : done ? 'is-done' : ''}>
              <span aria-hidden="true" />
              {label}
            </li>
          )
        })}
      </ol>

      {running && (
        <p className="pr-note">
          Импорт продолжается на сервере — страницу можно закрыть и вернуться позже.
        </p>
      )}
    </section>
  )
}
