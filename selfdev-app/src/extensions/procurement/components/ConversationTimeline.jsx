import React from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from './AsyncState'
import { StatusBadge } from './StatusBadge'
import { buildTimeline, pendingDecisions } from '../lib/timeline'
import { checkSummary } from '../lib/compositions'
import {
  COMPOSITION_STATUS_LABELS, KIND_SINGULAR, STAGE_LABELS, TOPIC_LABELS, TRIGGER_LABELS,
} from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, MessageSquare } from './icons'

const MESSAGE_KIND_LABELS = {
  system_outbound: 'Сообщение системы',
  supplier: 'Ответ поставщика',
  interpretation: 'Интерпретация агента',
  human: 'Действие специалиста',
  error: 'Ошибка',
}

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** The compact "why" line under a message that the playbook shaped. */
function Attribution({ record }) {
  if (!record) return null
  const summary = checkSummary(record.checks)
  return (
    <details className="pr-attribution-inline">
      <summary>
        Почему так написано · правил: {record.appliedItems?.length || 0}
        {summary.failed > 0 ? ` · проверок не пройдено: ${summary.failed}` : ''}
      </summary>
      <ul>
        <li>Стадия: {STAGE_LABELS[record.stage] || record.stage}</li>
        <li>Повод: {TRIGGER_LABELS[record.trigger] || record.trigger}</li>
        {record.detectedTopics?.length > 0 && (
          <li>Темы: {record.detectedTopics.map(topic => TOPIC_LABELS[topic] || topic).join(', ')}</li>
        )}
        {record.appliedItems?.map(item => (
          <li key={`${item.itemId}-${item.version}`}>
            <Link to={`/procurement/communication/playbook/${item.itemId}`}>{item.title}</Link>
            {' '}<span className="pr-muted">{KIND_SINGULAR[item.kind] || item.kind} v{item.version}</span>
          </li>
        ))}
        {record.withheld?.length > 0 && <li>Не раскрыто: {record.withheld.join(', ')}</li>}
      </ul>
      <Link to={`/procurement/communication/drafts/${record.compositionId}`}>Полный разбор</Link>
    </details>
  )
}

function MessageEntry({ entry }) {
  const { message, attribution } = entry
  return (
    <article className={`pr-message pr-message--${message.kind}`}>
      <div className="pr-message__marker" />
      <div>
        <header>
          <div>
            <span className="pr-eyebrow">{MESSAGE_KIND_LABELS[message.kind] || message.kind}</span>
            <strong>{message.author}</strong>
          </div>
          <time>{formatDate(message.createdAt)}</time>
        </header>
        <p>{message.text}</p>
        <div className="pr-inline-actions">
          <StatusBadge status={message.status} compact />
        </div>
        <Attribution record={attribution} />
      </div>
    </article>
  )
}

/** A draft that never reached the supplier: held, blocked, refused, or queued. */
function CompositionEntry({ entry }) {
  const record = entry.composition
  const summary = checkSummary(record.checks)
  const blocked = record.status === 'BLOCKED'
  return (
    <article className={`pr-message pr-message--draft${blocked ? ' pr-message--blocked' : ''}`}>
      <div className="pr-message__marker" />
      <div>
        <header>
          <div>
            <span className="pr-eyebrow">Черновик агента · не отправлено</span>
            <strong>{COMPOSITION_STATUS_LABELS[record.status] || record.status}</strong>
          </div>
          <time>{formatDate(record.createdAt)}</time>
        </header>
        <p>{record.editedText || record.draftText}</p>
        {blocked && summary.blocking.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Задержано проверками</AlertTitle>
            <AlertDescription>
              {summary.blocking.map(check => check.detail).join(' ')}
            </AlertDescription>
          </Alert>
        )}
        <div className="pr-inline-actions">
          <StatusBadge status={record.status} compact />
          <Badge variant="outline">{STAGE_LABELS[record.stage] || record.stage}</Badge>
          <Link to={`/procurement/communication/drafts/${record.compositionId}`}>
            Разобрать и решить
          </Link>
        </div>
        <Attribution record={record} />
      </div>
    </article>
  )
}

function StatusEntry({ entry }) {
  const { event } = entry
  return (
    <article className="pr-message pr-message--status">
      <div className="pr-message__marker" />
      <div>
        <header>
          <div>
            <span className="pr-eyebrow">Смена статуса</span>
            <strong>{event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}</strong>
          </div>
          <time>{formatDate(event.changedAt)}</time>
        </header>
        <p className="pr-muted">
          {event.source}
          {event.reason ? ` · ${event.reason}` : ''}
          {event.actorPrincipalKey ? ` · ${event.actorPrincipalKey}` : ''}
        </p>
      </div>
    </article>
  )
}

/**
 * One column for a supplier conversation: what was sent, what came back, what
 * the agent wrote but did not send, and how the assignment moved between them.
 */
export function ConversationTimeline({ negotiation, compositions = [], showStatusChanges = true }) {
  const timeline = buildTimeline({
    messages: negotiation?.messages || [],
    compositions,
    statusHistory: showStatusChanges ? negotiation?.statusHistory || [] : [],
  })
  const waiting = pendingDecisions(timeline)

  if (timeline.length === 0) {
    return (
      <EmptyState
        title="Событий пока нет"
        description="Создание задания не отправляет RFQ. После явной постановки в очередь здесь появятся сообщения, черновики и смены статуса."
      />
    )
  }

  return (
    <div className="pr-conversation">
      {waiting.length > 0 && (
        <Alert>
          <Clock />
          <AlertTitle>Сообщений ждёт решения: {waiting.length}</AlertTitle>
          <AlertDescription>
            Поставщику они не отправлены. Откройте черновик, чтобы подтвердить, поправить или отменить.
          </AlertDescription>
        </Alert>
      )}
      <div className="pr-timeline">
        {timeline.map(entry => {
          if (entry.kind === 'message') return <MessageEntry key={entry.id} entry={entry} />
          if (entry.kind === 'composition') return <CompositionEntry key={entry.id} entry={entry} />
          return <StatusEntry key={entry.id} entry={entry} />
        })}
      </div>
      <p className="pr-muted">
        <MessageSquare size={13} /> Черновики и разбор приходят из библиотеки коммуникации;
        сообщения — из журнала каналов.
      </p>
    </div>
  )
}
