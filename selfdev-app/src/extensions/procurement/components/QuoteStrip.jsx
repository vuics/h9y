import React from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from './StatusBadge'
import { channelLabel } from '../lib/thread'

/** The commercial terms of one revision, under the message they came from.
 *
 * The proposal page shows the same values in full; this is the version a
 * specialist reads without leaving the conversation — every field on one line
 * of sight, the empty ones included, because a quotation that says nothing
 * about payment terms is a fact about the quotation.
 */
export function QuoteStrip({ quote, previous = null }) {
  if (!quote) return null
  const before = new Map((previous?.fields || []).map(field => [field.key, field.value]))
  return (
    <section className="pr-quote">
      <header>
        <strong>Предложение {quote.responseId} · ревизия {quote.revision}</strong>
        {/* A revision that could not be tied to a message in this thread says
            where it did come from, instead of implying the supplier wrote it
            here. */}
        {!quote.communicationId && (
          <span className="pr-muted">
            {quote.channel ? `источник: ${channelLabel(quote.channel)}` : 'источник не связан с сообщением'}
            {quote.revisionCount > 1 ? ` · ревизий: ${quote.revisionCount}` : ''}
          </span>
        )}
        {quote.completeness && <StatusBadge status={quote.completeness} compact />}
        {quote.productIdentityStatus === 'MISMATCH' && (
          <StatusBadge status="MISMATCH" label="Другой продукт" compact />
        )}
        <Link to={`/procurement/proposals/${quote.responseId}`}>Открыть предложение</Link>
      </header>
      <div className="pr-quote__grid">
        {quote.fields.map(field => {
          const changed = previous && before.has(field.key) && before.get(field.key) !== field.value
          return (
            <div
              key={field.key}
              className={`pr-quote__cell${field.value ? '' : ' is-empty'}${field.status === 'CONFLICT' ? ' is-conflict' : ''}`}
            >
              <span>{field.label}</span>
              <strong>{field.value || 'не указано'}</strong>
              {/* A price that moved between two answers is the negotiation
                  itself; without the previous value beside it, a revision reads
                  as if it were the first thing the supplier ever said. */}
              {changed && <small>было: {before.get(field.key) || 'не указано'}</small>}
            </div>
          )
        })}
      </div>
      {quote.conflictingFields?.length > 0 && (
        <p className="pr-quote__note">Противоречия: {quote.conflictingFields.join(', ')}</p>
      )}
    </section>
  )
}
