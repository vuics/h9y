import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { channelLabel } from '../lib/thread'
import { rfqVersionText } from '../lib/rfqVersions'
import { CLOSE_REASONS, menuActions, sendOutcome } from '../lib/threadActions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RowMenu } from './RowMenu'

const failureText = error =>
  error?.response?.data?.message || error?.response?.data?.detail?.message || error?.message || 'действие не выполнено'

/** The conversation actions of one position's lines, and what each came to.
 *
 * Every action reports back on the line it was taken from, in words, and the
 * list is read again after it: a button that changed something must show the
 * change where it was pressed.
 */
export function useConversationActions(campaignId) {
  const queryClient = useQueryClient()
  const [outcomes, setOutcomes] = useState(() => new Map())
  const report = (key, outcome) => setOutcomes(current => new Map(current).set(key, outcome))
  const forget = key => setOutcomes(current => {
    const next = new Map(current)
    next.delete(key)
    return next
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaignConversations(campaignId) })
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
  }
  const failed = label => (error, variables) =>
    report(variables.key, { tone: 'danger', text: `${label}: ${failureText(error)}` })

  const send = useMutation({
    mutationFn: ({ assignmentId }) => procurementApi.sendCampaignConversations(campaignId, [assignmentId]),
    onSuccess: (result, { key, assignmentId }) => {
      if (result?.conversations) {
        queryClient.setQueryData(procurementKeys.campaignConversations(campaignId), result.conversations)
      }
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
      report(key, sendOutcome(result, assignmentId))
    },
    onError: failed('Не отправлено'),
  })
  const automation = useMutation({
    mutationFn: ({ assignmentId, paused }) => procurementApi.setNegotiationAutomation(assignmentId, paused),
    onSuccess: (_result, { key, paused }) => {
      report(key, { tone: 'success', text: paused ? 'Агент остановлен: сам писать не будет.' : 'Агент снова ведёт переписку.' })
      refresh()
    },
    onError: failed('Не переключено'),
  })
  const remind = useMutation({
    mutationFn: ({ assignmentId }) => procurementApi.queueNegotiation(assignmentId, { priority: 50, next_action_at: null }),
    onSuccess: (_result, { key }) => {
      report(key, { tone: 'success', text: 'Поставлено в очередь на отправку сейчас.' })
      refresh()
    },
    onError: failed('Не поставлено в очередь'),
  })
  const close = useMutation({
    mutationFn: ({ assignmentId, reason, note }) => procurementApi.closeNegotiation(assignmentId, { reason, note }),
    onSuccess: (_result, { key }) => {
      report(key, { tone: 'success', text: 'Переписка закрыта.' })
      refresh()
    },
    onError: failed('Не закрыто'),
  })
  const closeAll = useMutation({
    mutationFn: ({ cardId, reason, note }) => procurementApi.closeCampaignConversations(campaignId, { cardId, reason, note }),
    onSuccess: (result, { key }) => {
      if (result?.conversations) {
        queryClient.setQueryData(procurementKeys.campaignConversations(campaignId), result.conversations)
      }
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
      const count = result?.closed?.length || 0
      report(key, { tone: 'success', text: count ? `Закрыто переписок: ${count}.` : 'Открытых переписок не осталось.' })
    },
    onError: failed('Не закрыто'),
  })
  const pending = [send, automation, remind, close, closeAll].some(mutation => mutation.isPending)
  return { send, automation, remind, close, closeAll, outcomes, forget, pending }
}

/** The line's button and its «⋮»: one thing it waits on, the rest tucked away. */
export function LineControls({ thread, primary, onPrimary, onMenu, disabled }) {
  const items = menuActions(thread)
  return <span className="pr-supplier-line__controls">
    {primary && (primary.kind === 'link'
      ? <Link className="pr-line-action" to={primary.to}>{primary.label}</Link>
      : <button type="button" className="pr-line-action" disabled={disabled} onClick={() => onPrimary(primary)}>{primary.label}</button>)}
    <RowMenu label={`Действия с перепиской: ${thread.supplierName || thread.assignmentId}`}>
      {items.map(item => (item.kind === 'link'
        ? <Link key={item.label} to={item.to} role="menuitem">{item.label}</Link>
        : <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? 'pr-row-menu__danger' : undefined}
          disabled={disabled}
          onClick={() => onMenu(item)}
        >{item.label}</button>))}
    </RowMenu>
  </span>
}

/** The letter a line's «Отправить» sends, read before it goes.
 *
 * The agent assembles it from the approved RFQ when it sends, so the approved
 * RFQ is what is shown; the server refuses the send if that text has been
 * rebuilt since the conversation was prepared.
 */
export function SendPreview({ thread, cardId, onSend, onCancel, pending }) {
  const rfq = useQuery({
    queryKey: procurementKeys.rfq(cardId),
    queryFn: ({ signal }) => procurementApi.rfq(cardId, signal),
  })
  const text = rfqVersionText(rfq.data, 'english') || rfqVersionText(rfq.data, 'russian')
  return <div className="pr-line-panel">
    <p className="pr-line-panel__title">
      Уйдёт поставщику <b>{thread.supplierName || thread.assignmentId}</b> · {channelLabel(thread.channel)}
    </p>
    {rfq.isLoading
      ? <p className="pr-muted">Загружаем текст RFQ…</p>
      : text
        ? <pre className="pr-line-panel__letter">{text}</pre>
        : <p className="pr-muted">Текст согласованного RFQ не найден — откройте переписку, чтобы проверить письмо.</p>}
    <div className="pr-line-panel__bar">
      <Button size="sm" isDisabled={pending || !text} onPress={onSend}>{pending ? 'Отправляем…' : 'Отправить'}</Button>
      <Link to={`/procurement/negotiations/${thread.assignmentId}`}>Открыть переписку</Link>
      <Button size="sm" variant="ghost" onPress={onCancel}>Отмена</Button>
    </div>
  </div>
}

/** Ending one conversation, or all of a position's, with the reason chosen. */
export function ClosePanel({ subject, count = 1, onClose, onCancel, pending }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [missing, setMissing] = useState(false)
  const submit = () => {
    if (!reason) {
      setMissing(true)
      return
    }
    onClose({ reason, note: note.trim() })
  }
  return <div className="pr-line-panel">
    <p className="pr-line-panel__title">
      {count > 1 ? <>Закрыть {count} переписок по позиции <b>{subject}</b></> : <>Закрыть переписку с <b>{subject}</b></>}
    </p>
    <p className="pr-muted">Агент перестанет писать, неотправленные письма будут отозваны, открытые эскалации закроются. Открыть переписку заново нельзя.</p>
    <fieldset className="pr-line-panel__reasons" onChange={() => setMissing(false)}>
      <legend>Причина</legend>
      {CLOSE_REASONS.map(item => <label key={item.code}>
        <input type="radio" name={`close-${subject}`} value={item.code} checked={reason === item.code} onChange={() => setReason(item.code)} />
        {item.label}
      </label>)}
    </fieldset>
    {missing && <p className="pr-line-panel__error" role="alert">Выберите причину.</p>}
    <Textarea
      value={note}
      maxLength={500}
      rows={2}
      placeholder="Комментарий, если нужен: у кого купили, что ответил поставщик"
      onChange={event => setNote(event.target.value)}
    />
    <div className="pr-line-panel__bar">
      <Button size="sm" variant="destructive" isDisabled={pending} onPress={submit}>{pending ? 'Закрываем…' : 'Закрыть'}</Button>
      <Button size="sm" variant="ghost" onPress={onCancel}>Отмена</Button>
    </div>
  </div>
}

/** What the last action on a line came to. */
export function LineOutcome({ outcome, onDismiss }) {
  return <div className="pr-line-outcome" data-tone={outcome.tone} role="status">
    <span>{outcome.text}</span>
    <button type="button" className="pr-link-button" onClick={onDismiss} aria-label="Скрыть">✕</button>
  </div>
}
