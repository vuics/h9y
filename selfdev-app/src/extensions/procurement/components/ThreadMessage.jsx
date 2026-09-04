import React, { useState } from 'react'
import { Link } from 'react-router-dom'

import { QuoteStrip } from './QuoteStrip'
import { StatusBadge } from './StatusBadge'
import { checkSummary } from '../lib/compositions'
import {
  channelLabel, deliveryLabel, highlightSegments, isLongText, textPreview,
} from '../lib/thread'
import {
  CHECK_LABELS, KIND_SINGULAR, STAGE_LABELS, TOPIC_LABELS, TRIGGER_LABELS,
} from '../lib/playbookLabels'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from './icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** The message body with the extracted values marked inside it.
 *
 * The marks are the extractor's own character ranges, so hovering one answers
 * the question the proposal page otherwise answers three clicks away: which
 * sentence produced this number.
 */
export function HighlightedText({ text, spans = [], enabled = true }) {
  if (!enabled || !spans.length) return <p className="pr-msg__text">{text}</p>
  return (
    <p className="pr-msg__text">
      {highlightSegments(text, spans).map((segment, index) => (
        segment.span ? (
          <mark
            key={index}
            className={`pr-mark${segment.span.status === 'CONFLICT' ? ' pr-mark--conflict' : ''}`}
            title={`${segment.span.label}${segment.span.value ? `: ${segment.span.value}` : ''}`}
          >
            {segment.text}
          </mark>
        ) : <React.Fragment key={index}>{segment.text}</React.Fragment>
      ))}
    </p>
  )
}

/** A long message folded to its opening, with the whole of it one click away.
 *
 * An approved RFQ runs to several hundred lines. Rendered in full it pushes
 * every reply that followed it off the screen, which is how a conversation
 * became unreadable exactly when it got interesting.
 */
export function FoldedText({ text, spans, highlight }) {
  const [open, setOpen] = useState(false)
  const long = isLongText(text)
  if (!long || open) {
    return (
      <>
        <HighlightedText text={text} spans={spans} enabled={highlight} />
        {long && (
          <button type="button" className="pr-link-button" onClick={() => setOpen(false)}>
            Свернуть
          </button>
        )}
      </>
    )
  }
  return (
    <>
      <HighlightedText text={textPreview(text)} spans={[]} enabled={false} />
      <button type="button" className="pr-link-button" onClick={() => setOpen(true)}>
        Показать целиком · {String(text || '').split('\n').length} строк
      </button>
    </>
  )
}

/** Why one message says what it says: the rules, the checks, what was withheld. */
export function Attribution({ record }) {
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
            {item.reason && <span className="pr-muted"> · {item.reason}</span>}
          </li>
        ))}
        {record.checks?.map(check => (
          <li key={check.check} className={`pr-check-line pr-check-line--${check.status.toLowerCase()}`}>
            {check.status === 'FAILED' ? '✕' : check.status === 'PASSED' ? '✓' : '·'}{' '}
            {CHECK_LABELS[check.check] || check.check}: {check.detail}
          </li>
        ))}
        {record.withheld?.length > 0 && <li>Не раскрыто: {record.withheld.join(', ')}</li>}
      </ul>
      <Link to={`/procurement/communication/drafts/${record.compositionId}`}>Полный разбор</Link>
    </details>
  )
}

const AUTHOR_KIND = {
  supplier: 'Ответ поставщика',
  system_outbound: 'Наше сообщение',
  system_error: 'Ошибка доставки',
  interpretation: 'Интерпретация агента',
  human: 'Действие специалиста',
}

/** One delivered message, with everything that was made of it underneath. */
export function ThreadMessage({ entry, highlight = true, negotiationId }) {
  const { message, attribution, quotes = [] } = entry
  return (
    <article className={`pr-msg pr-msg--${message.kind}`} id={`msg-${message.id}`}>
      <header>
        <span className={`pr-chan pr-chan--${message.channel || 'unknown'}`}>
          {channelLabel(message.channel)}
        </span>
        <strong>{message.author}</strong>
        <span className="pr-eyebrow">{AUTHOR_KIND[message.kind] || message.kind}</span>
        <time>{formatDate(message.createdAt)}</time>
      </header>
      {message.subject && <p className="pr-msg__subject">{message.subject}</p>}
      <FoldedText text={message.text} spans={message.spans} highlight={highlight} />
      <div className="pr-msg__foot">
        <StatusBadge status={message.status} label={deliveryLabel(message.status)} compact />
        {message.attachments?.length > 0 && message.attachments.map(url => (
          <a key={url} href={url} target="_blank" rel="noreferrer">Вложение <ExternalLink size={12} /></a>
        ))}
        {message.sourceId && <Badge variant="outline" title="Источник извлечения">{message.sourceId}</Badge>}
      </div>
      <Attribution record={attribution} />
      {quotes.map((quote, index) => (
        <QuoteStrip
          key={`${quote.responseId}-${quote.revision}`}
          quote={quote}
          previous={quotes[index - 1] || entry.previousQuote || null}
        />
      ))}
      {message.kind === 'system_error' && (
        <p className="pr-msg__error">
          Сообщение не ушло. Проверьте канал и повторите отправку из очереди —{' '}
          <Link to={`/procurement/negotiations/${negotiationId}`}>задание</Link> остаётся в работе.
        </p>
      )}
    </article>
  )
}
