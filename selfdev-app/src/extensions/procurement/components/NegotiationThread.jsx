import React, { useMemo, useState } from 'react'

import { EmptyState } from './AsyncState'
import { ChannelPicker, PlannedAction, ThreadDraft } from './ThreadDraft'
import { CardChangeEvent, EscalationEvent, StatusGroup, StatusLine } from './ThreadEvents'
import { QuoteStrip } from './QuoteStrip'
import { ThreadMessage } from './ThreadMessage'
import { buildTimeline, collapseStatusRuns, splitFuture } from '../lib/timeline'
import { channelLabel, threadSide } from '../lib/thread'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare } from './icons'

/** Quick openings that produce a draft instead of a sent message. */
const INTENTS = [
  ['Запросить CoA по партии', 'Please send a recent representative-batch CoA with numeric results for the material you are offering, stating whether it is from the proposed batch.'],
  ['Уточнить базис и место', 'Please confirm the exact Incoterms 2020 rule and the exact named place for your quotation, and whether freight, export clearance and import duties are included.'],
  ['Запросить условия оплаты', 'Please state your payment terms, including any deposit, the payment route, and whether the beneficiary legal name matches the contracting party.'],
  ['Зафиксировать срок котировки', 'Please state a firm validity date for this quotation.'],
]

const CHANNEL_FILTERS = ['email', 'whatsapp', 'web_form', 'xmpp']

/** The conversation, everything scheduled on it, and the box to add to it.
 *
 * One column, in order: what the supplier said, what we said, what the system
 * did, what changed under the negotiation, and — below the line marking now —
 * everything that has not been sent yet. Nothing here sends: the composer
 * produces a draft that goes through the same checks and the same approval as
 * a generated one.
 */
export function NegotiationThread({
  negotiation, compositions = [], escalations = [], actions, permissions, canQueue = false,
}) {
  const [highlight, setHighlight] = useState(true)
  const [channel, setChannel] = useState('all')
  const [draft, setDraft] = useState('')

  const canDecide = permissions.canQueueNegotiations
  const timeline = useMemo(() => buildTimeline({
    messages: negotiation.messages || [],
    compositions,
    statusHistory: negotiation.statusHistory || [],
    quotes: negotiation.quotes || [],
    escalations,
    cardChange: negotiation.cardChange,
  }), [negotiation, compositions, escalations])

  const { past, future } = splitFuture(timeline, negotiation)
  const visible = channel === 'all'
    ? past
    : past.filter(entry => entry.kind !== 'message' || entry.message.channel === channel)
  const folded = collapseStatusRuns(visible)
  const counts = (negotiation.messages || []).reduce((totals, message) => ({
    ...totals, [message.channel]: (totals[message.channel] || 0) + 1,
  }), {})

  const renderEntry = entry => {
    if (entry.kind === 'message') {
      return <ThreadMessage entry={entry} highlight={highlight} negotiationId={negotiation.id} />
    }
    if (entry.kind === 'composition') {
      return (
        <ThreadDraft
          record={entry.composition}
          contacts={negotiation.contacts || []}
          negotiation={negotiation}
          actions={actions}
          canDecide={canDecide}
        />
      )
    }
    if (entry.kind === 'planned') {
      return (
        <PlannedAction
          entry={entry}
          contacts={negotiation.contacts || []}
          actions={actions}
          canDecide={canDecide}
        />
      )
    }
    if (entry.kind === 'escalation') {
      return (
        <EscalationEvent
          escalation={entry.escalation}
          actions={actions}
          permissions={permissions}
        />
      )
    }
    if (entry.kind === 'cardChange') {
      return (
        <CardChangeEvent
          change={entry.cardChange}
          negotiation={negotiation}
          actions={actions}
          canDecide={permissions.canManageNegotiations}
        />
      )
    }
    if (entry.kind === 'quote') return <QuoteStrip quote={entry.quote} />
    if (entry.kind === 'statusGroup') return <StatusGroup events={entry.events} />
    return <StatusLine event={entry.event} />
  }

  return (
    <div className="pr-thread">
      <div className="pr-thread__filters">
        <button
          type="button"
          className="pr-chip"
          aria-pressed={channel === 'all'}
          onClick={() => setChannel('all')}
        >
          Все каналы
        </button>
        {CHANNEL_FILTERS.filter(item => counts[item]).map(item => (
          <button
            key={item}
            type="button"
            className="pr-chip"
            aria-pressed={channel === item}
            onClick={() => setChannel(item)}
          >
            {channelLabel(item)} · {counts[item]}
          </button>
        ))}
        <span className="pr-thread__spacer" />
        <button
          type="button"
          className="pr-chip"
          aria-pressed={highlight}
          onClick={() => setHighlight(current => !current)}
        >
          Подсветка данных
        </button>
      </div>

      {folded.length === 0 && future.length === 0 && (
        <EmptyState
          title="Событий пока нет"
          description="Создание задания не отправляет RFQ. После явной постановки в очередь здесь появятся сообщения, черновики и решения."
        />
      )}

      <div className="pr-thread__entries">
        {folded.map(entry => (
          <div key={entry.id} className={`pr-row pr-row--${threadSide(entry)}`}>{renderEntry(entry)}</div>
        ))}
      </div>

      {(future.length > 0 || canQueue) && (
        <>
          <p className="pr-nowline">Сейчас</p>
          <div className="pr-thread__entries">
            {future.map(entry => (
              <div key={entry.id} className={`pr-row pr-row--${threadSide(entry)}`}>{renderEntry(entry)}</div>
            ))}
            {/* Nothing is scheduled and nothing is waiting: the conversation
                is idle, and the only honest thing to show is the one action
                that would start it moving again. */}
            {future.length === 0 && canQueue && (
              <div className="pr-row pr-row--out">
                <article className="pr-draft pr-draft--planned">
                  <header>
                    <strong>Ничего не запланировано</strong>
                  </header>
                  <p className="pr-muted">
                    Агент отправит согласованный RFQ или уточнение, когда задание попадёт
                    в рабочую очередь. Это отдельное явное действие.
                  </p>
                  <div className="pr-inline-actions">
                    <Button size="sm" isDisabled={actions.pendingQueue} onPress={() => actions.sendNow()}>
                      Поставить в очередь сейчас
                    </Button>
                  </div>
                </article>
              </div>
            )}
          </div>
        </>
      )}

      {canDecide && (
        <div className="pr-composer">
          <div className="pr-composer__intents">
            {INTENTS.map(([label, body]) => (
              <button key={label} type="button" className="pr-chip" onClick={() => setDraft(body)}>
                {label}
              </button>
            ))}
          </div>
          <Textarea
            rows={3}
            value={draft}
            placeholder="Написать поставщику… Текст пройдёт те же проверки и станет черновиком — он не уйдёт без подтверждения."
            onChange={event => setDraft(event.target.value)}
          />
          <div className="pr-composer__foot">
            <ChannelPicker
              contacts={negotiation.contacts || []}
              value={negotiation.contactId}
              onChange={contactId => actions.setNegotiationChannel(contactId)}
            />
            <Button
              isDisabled={!draft.trim() || actions.pendingDraft}
              onPress={() => actions.createDraft(draft, () => setDraft(''))}
            >
              <MessageSquare size={15} />Подготовить черновик
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
