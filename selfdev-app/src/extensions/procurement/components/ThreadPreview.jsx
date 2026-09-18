import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { buildTimeline } from '../lib/timeline'
import { ThreadMessage } from './ThreadMessage'

const SHOWN = 3

/** The last few letters of a conversation, read where the decision is made.
 *
 * A decision on an escalation is taken on what the supplier wrote; opening
 * the conversation in another tab to find out is the detour the customer
 * described. The full thread, with drafts and sending, stays one link away.
 */
export function ThreadPreview({ negotiationId }) {
  const query = useQuery({
    queryKey: procurementKeys.negotiation(negotiationId),
    queryFn: ({ signal }) => procurementApi.negotiation(negotiationId, signal),
    enabled: Boolean(negotiationId),
  })
  if (!negotiationId) return <p className="pr-note">У этой эскалации нет переписки.</p>
  if (query.isLoading) return <p className="pr-note">Загружаем переписку…</p>
  if (query.isError || !query.data) return <p className="pr-note">Переписку не удалось загрузить. <Link to={`/procurement/negotiations/${negotiationId}`}>Открыть переговоры</Link></p>
  const negotiation = query.data
  const messages = buildTimeline({
    messages: negotiation.messages || [],
    compositions: [],
    statusHistory: [],
    quotes: negotiation.quotes || [],
    escalations: [],
    cardChange: null,
  }).filter(entry => entry.kind === 'message')
  const shown = messages.slice(-SHOWN)
  return <div className="pr-thread-preview">
    {messages.length > shown.length && <p className="pr-note">Ранее — ещё {messages.length - shown.length}. Показаны последние письма.</p>}
    {shown.length ? shown.map(entry => <ThreadMessage key={entry.id} entry={entry} />) : <p className="pr-note">Писем пока нет.</p>}
    <Link to={`/procurement/negotiations/${negotiationId}`}>Вся переписка и ответ поставщику →</Link>
  </div>
}
