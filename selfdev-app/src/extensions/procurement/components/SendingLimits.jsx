import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { plural } from './SourcingSettings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Clock } from './icons'

const REASON = {
  OPEN: 'письма уходят',
  PACING: 'пауза между письмами',
  BEFORE_WINDOW: 'окно отправки ещё не началось',
  AFTER_WINDOW: 'окно отправки на сегодня закрыто',
  DAILY_LIMIT: 'дневной лимит исчерпан',
  PAUSED: 'отправка писем приостановлена',
}

const time = value => value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
const mutationMessage = error => error?.response?.data?.message || error?.message

/** "Сегодня отправлено 34 из 80 · в очереди 120 — уйдут примерно за 2 дня".
 *
 * Shared by the settings card and the agent page, so a queue that waits on the
 * limit reads as waiting, not as stuck, wherever someone looks at it.
 */
export function SendingUsageLine({ usage }) {
  if (!usage) return null
  const { sentToday, limit, waiting, daysToClear, reason, nextAt, open } = usage
  const queue = waiting > 0
    ? ` · в очереди ${waiting} ${plural(waiting, 'письмо', 'письма', 'писем')}${daysToClear === 0 ? ' — уйдут сегодня' : daysToClear ? ` — уйдут примерно за ${daysToClear} ${plural(daysToClear, 'день', 'дня', 'дней')}` : ''}`
    : ''
  const state = open ? '' : ` · ${REASON[reason] || reason}${nextAt ? `, следующее письмо ${time(nextAt)}` : ''}`
  return <p className="pr-note"><Clock size={13} /> Сегодня отправлено {sentToday} из {limit}{queue}{state}.</p>
}

export function SendingLimitsCard({ canEdit }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: procurementKeys.sendingLimits(),
    queryFn: ({ signal }) => procurementApi.sendingLimits(signal),
    refetchInterval: 60000,
  })
  const [draft, setDraft] = useState(null)
  useEffect(() => { if (query.data && !draft) setDraft(query.data.limits) }, [query.data, draft])
  const save = useMutation({
    mutationFn: () => procurementApi.saveSendingLimits({ ...draft, emailsPerDay: Number(draft.emailsPerDay) }),
    onSuccess: value => {
      queryClient.setQueryData(procurementKeys.sendingLimits(), value)
      setDraft(value.limits)
    },
  })
  if (!draft) return null
  const set = (name, value) => setDraft(current => ({ ...current, [name]: value }))
  const changed = JSON.stringify(draft) !== JSON.stringify(query.data?.limits)
  const perDay = Number(draft.emailsPerDay) || 0

  return <Card><CardHeader><CardTitle><Clock /> Отправка писем</CardTitle></CardHeader><CardContent>
    <p className="pr-note">Все запросы уходят с одного почтового ящика. Холодные письма пачкой и повторные письма на недоставляемые адреса — то, из-за чего ящик ограничивают, и тогда не доходят даже письма поставщикам, которые отвечают. Начните с 50–100 в день и поднимайте, пока недоставок мало.</p>
    <div className="pr-card-form">
      <label className="pr-form-field"><span>Писем в день</span>
        <Input type="number" min={0} max={5000} value={draft.emailsPerDay} disabled={!canEdit} onChange={event => set('emailsPerDay', event.target.value)} />
        <small className="pr-muted">{perDay === 0 ? '0 — отправка писем приостановлена, остальное работает.' : 'Новые запросы и напоминания. Сверх лимита письмо ждёт в очереди следующего дня.'}</small>
      </label>
      <label className="pr-form-field"><span>Окно отправки, с</span>
        <Input type="time" value={draft.windowStart} disabled={!canEdit} onChange={event => set('windowStart', event.target.value)} />
      </label>
      <label className="pr-form-field"><span>по</span>
        <Input type="time" value={draft.windowEnd} disabled={!canEdit} onChange={event => set('windowEnd', event.target.value)} />
        <small className="pr-muted">Время {draft.timezone === 'Europe/Moscow' ? 'московское' : draft.timezone}. Письма распределяются по окну равномерно, а не уходят пачкой.</small>
      </label>
      <label className="pr-form-field pr-form-field--check">
        <input type="checkbox" checked={draft.repliesExempt} disabled={!canEdit} onChange={event => set('repliesExempt', event.target.checked)} />
        <span>Ответы вне лимита — поставщику, который уже ответил, письмо уходит сразу и не тратит лимит</span>
      </label>
      <label className="pr-form-field pr-form-field--check">
        <input type="checkbox" checked={draft.bouncesInvalidate} disabled={!canEdit} onChange={event => set('bouncesInvalidate', event.target.checked)} />
        <span>Недоставленные адреса — помечать контакт недействительным, а переговоры по нему передавать специалисту</span>
      </label>
    </div>
    <SendingUsageLine usage={query.data?.usage} />
    {save.error && <Alert><AlertTriangle /><AlertTitle>Не сохранено</AlertTitle><AlertDescription>{mutationMessage(save.error)}</AlertDescription></Alert>}
    {canEdit
      ? <div className="pr-inline-actions"><Button isDisabled={!changed || save.isPending} onPress={() => save.mutate()}>{save.isPending ? 'Сохраняем…' : 'Сохранить лимиты'}</Button></div>
      : <p className="pr-muted">Лимиты меняет администратор (BUYER_SETTINGS_MANAGE).</p>}
  </CardContent></Card>
}


/** How many supplier searches run at once; the rest wait their turn.
 *
 * Every search reads its sources through one model server. More searches at
 * once than it can answer only make each one wait and lose sources to
 * timeouts, so the limit is set to what the server keeps up with.
 */
export function SearchConcurrencyCard({ canEdit }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: procurementKeys.searchSettings(),
    queryFn: ({ signal }) => procurementApi.searchSettings(signal),
    refetchInterval: 30000,
  })
  const [value, setValue] = useState(null)
  useEffect(() => { if (query.data && value === null) setValue(String(query.data.settings.concurrentSearches)) }, [query.data, value])
  const save = useMutation({
    mutationFn: () => procurementApi.saveSearchSettings({ concurrentSearches: Number(value) }),
    onSuccess: data => {
      queryClient.setQueryData(procurementKeys.searchSettings(), data)
      setValue(String(data.settings.concurrentSearches))
    },
  })
  if (value === null) return null
  const queue = query.data?.queue
  const changed = Number(value) !== query.data?.settings.concurrentSearches

  return <Card><CardHeader><CardTitle><Clock /> Поиск поставщиков</CardTitle></CardHeader><CardContent>
    <p className="pr-note">Все поиски читают источники через одну модель. Если запустить больше поисков, чем она успевает обработать, каждый идёт медленнее и теряет источники по таймауту. Лишние поиски ждут своей очереди и начинаются сами, по порядку запуска.</p>
    <div className="pr-card-form">
      <label className="pr-form-field"><span>Одновременных поисков</span>
        <Input type="number" min={1} max={16} value={value} disabled={!canEdit} onChange={event => setValue(event.target.value)} />
        <small className="pr-muted">Меняется без перезапуска: очередь подхватит новое значение в течение полуминуты.</small>
      </label>
    </div>
    {queue && <p className="pr-note"><Clock size={13} /> Сейчас идёт поисков: {queue.running}{queue.waiting ? `, в очереди: ${queue.waiting}` : ''}.</p>}
    {save.error && <Alert><AlertTriangle /><AlertTitle>Не сохранено</AlertTitle><AlertDescription>{mutationMessage(save.error)}</AlertDescription></Alert>}
    {canEdit
      ? <div className="pr-inline-actions"><Button isDisabled={!changed || save.isPending || !(Number(value) >= 1)} onPress={() => save.mutate()}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</Button></div>
      : <p className="pr-muted">Меняет администратор (BUYER_SETTINGS_MANAGE).</p>}
  </CardContent></Card>
}
