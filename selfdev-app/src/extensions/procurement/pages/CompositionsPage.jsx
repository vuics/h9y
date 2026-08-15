import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge } from '../components/StatusBadge'
import {
  COMPOSITION_STATUS_LABELS, STAGE_LABELS, TRIGGER_LABELS,
} from '../lib/playbookLabels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock } from '../components/icons'

const STATUSES = ['DRAFT', 'BLOCKED', 'APPROVED', 'SENT', 'REJECTED']

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')
const excerpt = (text, limit = 180) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat
}

export default function CompositionsPage() {
  const [status, setStatus] = useState(null)
  const query = useQuery({
    queryKey: procurementKeys.compositions({ status }),
    queryFn: ({ signal }) => procurementApi.compositions(status ? { status } : {}, signal),
    refetchInterval: 30000,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const records = query.data?.compositions || []
  const waiting = records.filter(item => ['DRAFT', 'BLOCKED'].includes(item.status)).length

  return (
    <div className="pr-stack">
      <RouterLinkButton to="/procurement/communication" variant="ghost" size="sm">
        <ArrowLeft size={15} />Библиотека коммуникации
      </RouterLinkButton>

      <div className="pr-section-heading">
        <div>
          <h2>Сообщения поставщикам</h2>
          <p>
            Каждое сообщение, которое подготовил агент-переговорщик, — включая те, что не были
            отправлены. Открыв любое, видно, из чего оно собрано.
          </p>
        </div>
        {waiting > 0 && <Badge><Clock size={13} />Ждут решения: {waiting}</Badge>}
      </div>

      <div className="pr-inline-actions">
        <Button variant={status ? 'outline' : 'secondary'} size="sm" onPress={() => setStatus(null)}>Все</Button>
        {STATUSES.map(value => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'secondary' : 'outline'}
            onPress={() => setStatus(value)}
          >
            {COMPOSITION_STATUS_LABELS[value]}
          </Button>
        ))}
      </div>

      {records.length === 0
        ? <EmptyState
          title="Сообщений пока нет"
          description="Здесь появятся сообщения, как только агент-переговорщик начнёт переписку с поставщиками."
        />
        : <ul className="pr-composition-list">
          {records.map(record => (
            <li key={record.compositionId} className="pr-composition-row">
              <div className="pr-composition-row__head">
                <Link to={`/procurement/communication/drafts/${record.compositionId}`}>
                  {record.compositionId}
                </Link>
                <StatusBadge status={record.status} />
                <Badge variant="outline">{STAGE_LABELS[record.stage] || record.stage}</Badge>
                <Badge variant="outline">{record.channel}</Badge>
                {record.wasEdited && <Badge variant="outline">правлено человеком</Badge>}
              </div>
              <p className="pr-composition-row__text">
                {excerpt(record.editedText || record.draftText)}
              </p>
              <div className="pr-composition-row__meta">
                <span>{formatDate(record.createdAt)}</span>
                <span>повод: {TRIGGER_LABELS[record.trigger] || record.trigger}</span>
                <span>правил применено: {record.appliedItems?.length || 0}</span>
                {record.assignmentId && (
                  <Link to={`/procurement/negotiations/${record.assignmentId}`}>
                    {record.assignmentId}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>}

      {query.data?.hasMore && (
        <p className="pr-muted">
          Показаны последние сообщения. Уточните фильтр, чтобы увидеть остальные.
        </p>
      )}
    </div>
  )
}
