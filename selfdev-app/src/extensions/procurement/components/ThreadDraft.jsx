import React, { useEffect, useState } from 'react'

import { Attribution } from './ThreadMessage'
import { StatusBadge } from './StatusBadge'
import { checkSummary, finalText, hasUnsavedEdit } from '../lib/compositions'
import { channelLabel, contactWarning, relativeTime, selectableContacts } from '../lib/thread'
import { COMPOSITION_STATUS_LABELS, TRIGGER_LABELS } from '../lib/playbookLabels'
import { negotiationNextActionLabel } from '../api/negotiations'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Clock } from './icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** The datetime-local value for a moment, in the reader's own timezone. */
export function toLocalInput(value) {
  const at = value ? new Date(value) : null
  if (!at || Number.isNaN(at.getTime())) return ''
  const offset = at.getTimezoneOffset() * 60000
  return new Date(at.getTime() - offset).toISOString().slice(0, 16)
}

/** Which contact a message that has not gone out yet will leave through.
 *
 * Only addresses the supplier directory actually holds: choosing a channel
 * here is choosing a contact, so a deployment with no email address for this
 * supplier cannot accidentally schedule an email.
 */
export function ChannelPicker({ contacts = [], value, onChange, disabled = false }) {
  const options = selectableContacts(contacts)
  const current = contacts.find(item => item.contactId === value)
  const warning = current ? contactWarning(current) : null
  return (
    <label className="pr-channel-picker">
      <span>Канал</span>
      <select
        value={value || ''}
        disabled={disabled || options.length === 0}
        onChange={event => onChange(event.target.value)}
      >
        {options.length === 0 && <option value="">нет доступных контактов</option>}
        {options.map(contact => (
          <option key={contact.contactId} value={contact.contactId}>
            {channelLabel(contact.channel)} · {contact.address}
          </option>
        ))}
      </select>
      {warning && <small className="pr-muted">{warning}</small>}
    </label>
  )
}

/** A message that has not reached the supplier yet, editable where it lives.
 *
 * Everything a specialist can do about it is here — rewrite it, move it to
 * another channel, approve it, refuse it — because the draft and the thread it
 * belongs to were on two different pages, and deciding about one without
 * reading the other is how a wrong message gets approved.
 */
export function ThreadDraft({
  record, contacts, negotiation, actions, canDecide = false,
}) {
  const { compositionId, editedText, draftText } = record
  const [text, setText] = useState(finalText(record))
  const [note, setNote] = useState('')
  const [refusing, setRefusing] = useState(false)
  // Re-seeded only when the stored wording itself changes: a background
  // refetch must not throw away what someone is in the middle of typing.
  useEffect(() => { setText(editedText ?? draftText ?? '') }, [compositionId, editedText, draftText])

  const summary = checkSummary(record.checks)
  const unsaved = hasUnsavedEdit(record, text)
  const approved = record.status === 'APPROVED'
  const pending = actions.pendingComposition === record.compositionId
  return (
    <article className={`pr-draft${record.status === 'BLOCKED' ? ' pr-draft--blocked' : ''}`}>
      <header>
        <StatusBadge status={record.status} label={COMPOSITION_STATUS_LABELS[record.status]} compact />
        <span className="pr-eyebrow">{TRIGGER_LABELS[record.trigger] || record.trigger}</span>
        {approved && negotiation?.nextActionAt && (
          <span className="pr-muted">
            уйдёт {formatDate(negotiation.nextActionAt)} · {relativeTime(negotiation.nextActionAt)}
          </span>
        )}
        <time>{formatDate(record.createdAt)}</time>
      </header>

      <div className="pr-draft__bar">
        <ChannelPicker
          contacts={contacts}
          value={record.contactId || negotiation?.contactId}
          disabled={!canDecide || approved || pending}
          onChange={contactId => actions.setCompositionChannel(record.compositionId, contactId)}
        />
        {approved && (
          <label className="pr-form-field pr-form-field--inline">
            <span>Отправить не раньше</span>
            {/* On blur, not on change: a datetime field fires while the
                year is still half-typed, and each of those would re-queue the
                assignment at a nonsense time. */}
            <Input
              type="datetime-local"
              defaultValue={toLocalInput(negotiation?.nextActionAt)}
              disabled={!canDecide}
              onBlur={event => {
                if (event.target.value !== toLocalInput(negotiation?.nextActionAt)) {
                  actions.reschedule(event.target.value)
                }
              }}
            />
          </label>
        )}
      </div>

      {canDecide && !approved ? (
        <Textarea rows={9} value={text} onChange={event => setText(event.target.value)} />
      ) : (
        <p className="pr-msg__text">{finalText(record)}</p>
      )}

      {summary.blocking.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Не уйдёт, пока это не решено</AlertTitle>
          <AlertDescription>{summary.blocking.map(check => check.detail).join(' ')}</AlertDescription>
        </Alert>
      )}

      {canDecide && !approved && (
        <div className="pr-inline-actions">
          <Button
            size="sm"
            isDisabled={!text.trim() || pending}
            onPress={() => actions.approve(record, text)}
          >
            Подтвердить и поставить в очередь
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={!unsaved || pending}
            onPress={() => actions.saveEdit(record.compositionId, text)}
          >
            Сохранить правку
          </Button>
          <Button variant="outline" size="sm" onPress={() => setRefusing(current => !current)}>
            Отклонить
          </Button>
        </div>
      )}
      {refusing && (
        <div className="pr-draft__reject">
          <Textarea
            rows={2}
            value={note}
            placeholder="Почему это сообщение не должно уйти? Причина останется в истории."
            onChange={event => setNote(event.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            isDisabled={!note.trim() || pending}
            onPress={() => actions.reject(record.compositionId, note)}
          >
            Подтвердить отказ
          </Button>
        </div>
      )}
      <Attribution record={record} />
    </article>
  )
}

/** The dispatch the worker still owes: what, when, through which channel.
 *
 * Synthesised from the assignment rather than stored as a message, because
 * until it is sent there is no message — but a specialist planning their day
 * needs to see it in the same column as everything else.
 */
export function PlannedAction({ entry, contacts, actions, canDecide = false }) {
  const negotiation = entry.negotiation
  return (
    <article className="pr-draft pr-draft--planned">
      <header>
        <StatusBadge status="QUEUED" label="Запланировано" compact />
        <strong>{negotiationNextActionLabel(entry.action)}</strong>
        <time>{formatDate(entry.at)} · {relativeTime(entry.at)}</time>
      </header>
      <p className="pr-muted">
        Текст соберёт агент в момент отправки: подтверждённый RFQ или уточнение по
        последнему ответу. Пока сообщение не собрано, править нечего — можно
        перенести время или сменить канал.
      </p>
      <div className="pr-draft__bar">
        <ChannelPicker
          contacts={contacts}
          value={negotiation.contactId}
          disabled={!canDecide}
          onChange={contactId => actions.setNegotiationChannel(contactId)}
        />
        <label className="pr-form-field pr-form-field--inline">
          <span>Отправить не раньше</span>
          <Input
            type="datetime-local"
            defaultValue={toLocalInput(entry.at)}
            disabled={!canDecide}
            onBlur={event => {
              if (event.target.value !== toLocalInput(entry.at)) {
                actions.reschedule(event.target.value)
              }
            }}
          />
        </label>
        {canDecide && (
          <Button size="sm" variant="outline" onPress={() => actions.sendNow()}>
            <Clock size={14} />Отправить сейчас
          </Button>
        )}
      </div>
    </article>
  )
}
