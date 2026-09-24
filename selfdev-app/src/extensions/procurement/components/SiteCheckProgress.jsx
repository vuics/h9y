import React from 'react'
import { Button } from '@/components/ui/button'
import { Pause, Refresh } from './icons'
import { siteRunProgress } from '../lib/siteGrade'

/** The check of contacted suppliers' websites for one card.
 *
 * Styled as the search progress is, so the two read as the same kind of work.
 * While it runs: a spinner, "checked X of Y", a bar and a way to stop it. Once
 * done: one line saying when and what it found — a check that finds the same
 * «нет данных» again must still visibly have happened.
 */
export function SiteCheckProgress({ run, onStop, stopping }) {
  const progress = siteRunProgress(run)
  if (!progress) return null
  if (!progress.running) {
    return (
      <p className="pr-note pr-site-check__done" aria-live="polite">
        {progress.stopped ? 'Проверка сайтов остановлена' : 'Сайты поставщиков проверены'}
        {progress.finishedAt ? ` ${progress.finishedAt}` : ''} · {run.done} из {run.total} поставщиков · грейд найден у {run.found}
      </p>
    )
  }
  return (
    <section className="pr-sourcing-progress is-running pr-site-check" aria-live="polite">
      <header>
        <div className="pr-site-check__title">
          <Refresh size={16} className="pr-spin" />
          <div>
            <strong>Проверяем сайты поставщиков</strong>
            <span>{progress.text}. Грейд из ответа поставщика не меняется.</span>
          </div>
        </div>
        <div className="pr-inline-actions">
          <b aria-hidden="true">{progress.percent}%</b>
          <Button variant="outline" size="sm" isDisabled={stopping} onPress={onStop}><Pause />{stopping ? 'Останавливаем…' : 'Остановить проверку'}</Button>
        </div>
      </header>
      <div className="pr-sourcing-progress__track" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Готовность проверки сайтов">
        {progress.percent > 0
          ? <div className="pr-sourcing-progress__stack"><span className="is-good" style={{ width: `${progress.percent}%` }} /></div>
          : <div className="pr-sourcing-progress__indeterminate" />}
      </div>
    </section>
  )
}
