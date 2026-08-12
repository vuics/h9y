import React from 'react'
import { CircleAlert } from './icons'

const kindLabels = {
  WEB_SEARCH: 'Поисковая система',
  MARKETPLACE: 'B2B-площадка',
}

export function EnginePicker({ engines = [], selectedIds, onToggle, disabled }) {
  if (!engines.length) return null
  const usable = engines.filter(engine => engine.available)

  return (
    <section className="pr-engine-picker">
      <header>
        <strong>Источники поиска</strong>
        <span>
          {usable.length
            ? `Запрос уходит в каждый выбранный движок, результаты объединяются и дедуплицируются.`
            : 'Ни один движок не настроен — поиск не запустится.'}
        </span>
      </header>
      <ul>
        {engines.map(engine => {
          const checked = engine.available && selectedIds.includes(engine.id)
          return (
            <li key={engine.id} className={engine.available ? '' : 'is-unavailable'}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || !engine.available}
                  onChange={event => onToggle(engine.id, event.target.checked)}
                />
                <span>
                  <b>{engine.label}</b>
                  <small>{kindLabels[engine.kind] || engine.kind} · {engine.detail}</small>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {engines.some(engine => !engine.available) && (
        <p className="pr-note">
          <CircleAlert size={13} /> Недоступные движки включаются администратором через
          {' '}<code>SOURCING_SEARCH_ENGINES</code> и переменные окружения контейнера.
        </p>
      )}
    </section>
  )
}
