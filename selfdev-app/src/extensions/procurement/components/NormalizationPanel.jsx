import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, CircleAlert, Refresh, Search } from './icons'

// Ordered best-to-worst, so the bar reads left to right from verified to unusable.
const outcomes = [
  ['NORMALIZED', 'Подтверждено в PubChem', 'good', Check],
  ['NEEDS_REVIEW', 'Расхождение — нужна проверка', 'warn', CircleAlert],
  ['NOT_FOUND', 'Не найдено в PubChem', 'muted', Search],
  ['FAILED', 'Ошибка запроса', 'bad', CircleAlert],
]

function formatEta(seconds) {
  if (seconds == null) return null
  if (seconds < 45) return 'меньше минуты'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `≈ ${minutes} мин`
  const hours = Math.floor(minutes / 60)
  return `≈ ${hours} ч ${minutes % 60} мин`
}

/**
 * The PubChem verification pass, presented as its own step.
 *
 * It stays on screen in every state — available, running, finished — so the
 * specialist can see that a pass started, watch what it is finding while it
 * runs, and still read the outcome afterwards without reloading.
 */
export function NormalizationPanel({ run, canWrite, onStart, onCancel, isStarting, isCancelling, onFilterOutcome }) {
  const state = run?.normalization
  if (!state || state.state === 'UNAVAILABLE') return null

  const running = state.state === 'RUNNING'
  const done = state.state === 'DONE'
  const eta = formatEta(state.etaSeconds)
  const present = outcomes.filter(([key]) => state.counts?.[key] > 0)
  const barTotal = state.target || state.createdCards || 1

  return (
    <Card className={`pr-normalization${running ? ' is-running' : ''}`}>
      <CardHeader>
        <CardTitle>
          <Refresh size={16} className={running ? 'pr-spin' : undefined} />
          Сверка веществ с PubChem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="pr-normalization__head">
          <div>
            <strong>
              {running
                ? `Проверено ${state.done} из ${state.target}`
                : done
                  ? `Проверены все ${state.checked} карточек`
                  : `Не проверено карточек: ${state.pending}`}
            </strong>
            <span>
              {running
                ? state.cancelRequested
                  ? 'Останавливаем после текущих запросов…'
                  : `Идёт проверка CAS и наименований${eta ? ` · осталось ${eta}` : ''}`
                : done
                  ? 'Каждая карточка сверена с PubChem по CAS-номеру и наименованию.'
                  : 'Проверка подтвердит, что CAS и наименование описывают одно вещество.'}
            </span>
          </div>
          {(running || state.target > 0) && (
            <b aria-hidden="true">{running ? `${state.percent}%` : ''}</b>
          )}
        </div>

        {(running || state.checked > 0) && (
          <div
            className="pr-normalization__track"
            role="progressbar"
            aria-valuenow={state.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Готовность сверки с PubChem"
          >
            <div className="pr-normalization__stack">
              {outcomes.map(([key, , tone]) => (
                state.counts?.[key]
                  ? <span
                      key={key}
                      className={`is-${tone}`}
                      style={{ width: `${(state.counts[key] / barTotal) * 100}%` }}
                    />
                  : null
              ))}
              {running && state.done < state.target && (
                <span
                  className="is-pending"
                  style={{ width: `${((state.target - state.done) / barTotal) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}

        {present.length > 0 && (
          <ul className="pr-normalization__legend">
            {present.map(([key, label, tone, Icon]) => (
              <li key={key} className={`is-${tone}`}>
                <button
                  type="button"
                  onClick={() => onFilterOutcome?.(key)}
                  title={`Показать строки: ${label}`}
                >
                  <Icon size={13} />
                  {label}
                  <b>{state.counts[key]}</b>
                </button>
              </li>
            ))}
          </ul>
        )}

        {done && state.needsAttention > 0 && (
          <p className="pr-note pr-normalization__attention">
            <CircleAlert size={13} />
            Требуют внимания специалиста: {state.needsAttention}. Расхождение
            между CAS и наименованием — это признак того, что в файле указано не
            то вещество.
          </p>
        )}

        <div className="pr-normalization__actions">
          {running ? (
            <Button
              variant="outline"
              isDisabled={isCancelling || state.cancelRequested}
              onPress={onCancel}
            >
              {state.cancelRequested ? 'Останавливаем…' : 'Остановить сверку'}
            </Button>
          ) : state.pending > 0 ? (
            <Button isDisabled={!canWrite || isStarting} onPress={onStart}>
              <Refresh size={15} className={isStarting ? 'pr-spin' : undefined} />
              {isStarting
                ? 'Запускаем сверку…'
                : `Сверить ${state.pending} ${state.checked ? 'оставшихся ' : ''}карточек`}
            </Button>
          ) : null}
          {running && (
            <span className="pr-note">
              Проверка идёт на сервере с ограничением частоты запросов к PubChem —
              страницу можно закрыть и вернуться позже.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
