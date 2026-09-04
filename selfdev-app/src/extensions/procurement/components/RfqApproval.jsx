import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { StatusBadge } from './StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Check, FileCheck } from './icons'

const VERSIONS = [
  ['russian', 'Русская версия'],
  ['english', 'English version'],
]

/** Approve the RFQ from the conversation it is holding up.
 *
 * The full RFQ page stays where it is — regenerating, editing and comparing
 * versions belong there. What is here is the last step of that flow, which is
 * the one a specialist reaches from this side: the negotiation is paused, the
 * notice to the supplier is written and blocked, and the only thing missing is
 * a signature on the document behind it.
 *
 * The reading gate is kept deliberately: the button stays disabled until each
 * version has actually been opened. These texts are what the supplier receives
 * first, and approving one unread is exactly the mistake the gate exists for.
 */
export function RfqApproval({ cardId, canApprove = false }) {
  const queryClient = useQueryClient()
  const [read, setRead] = useState(new Set())
  const query = useQuery({
    queryKey: procurementKeys.rfq(cardId),
    queryFn: ({ signal }) => procurementApi.rfq(cardId, signal),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareRFQ(cardId),
    onSuccess: () => { setRead(new Set()); invalidate() },
  })
  const approve = useMutation({
    mutationFn: fingerprint => procurementApi.approveRFQ(cardId, fingerprint),
    onSuccess: invalidate,
  })
  const failure = prepare.error || approve.error
  const message = failure?.response?.data?.message || failure?.message

  if (query.isLoading) return <p className="pr-muted">RFQ загружается…</p>
  const document = query.data
  const versions = VERSIONS.filter(([key]) => document?.rfq?.[key])
  const everythingRead = versions.length > 0 && versions.every(([key]) => read.has(key))

  return (
    <section className="pr-rfq-inline">
      <header>
        <FileCheck size={14} />
        <strong>RFQ карточки #{cardId}</strong>
        <StatusBadge status={document?.status || 'NOT_PREPARED'} compact />
        <Link to={`/procurement/requests/${cardId}/rfq`}>Полная страница RFQ</Link>
      </header>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Действие не выполнено</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {versions.length === 0 ? (
        <>
          <p className="pr-muted">
            Под изменёнными требованиями документа ещё нет — его нужно собрать заново.
          </p>
          {canApprove && (
            <Button size="sm" isDisabled={prepare.isPending} onPress={() => prepare.mutate()}>
              {prepare.isPending ? 'Сборка…' : 'Собрать RFQ по новым требованиям'}
            </Button>
          )}
        </>
      ) : (
        <>
          {versions.map(([key, label]) => (
            <details
              key={key}
              className="pr-rfq-inline__version"
              onToggle={event => {
                if (event.currentTarget.open) {
                  setRead(current => new Set(current).add(key))
                }
              }}
            >
              <summary>
                {read.has(key) && <Check size={12} />}
                {label} · {document.rfq[key].bodyMarkdown?.length || 0} символов
              </summary>
              <p className="pr-msg__text">{document.rfq[key].bodyMarkdown}</p>
            </details>
          ))}
          {canApprove ? (
            <div className="pr-inline-actions">
              <Button
                size="sm"
                isDisabled={!everythingRead || approve.isPending || document.status === 'APPROVED'}
                onPress={() => approve.mutate(document.documentFingerprint)}
              >
                <FileCheck size={14} />
                {approve.isPending ? 'Согласование…' : 'Согласовать этот RFQ'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={prepare.isPending}
                onPress={() => prepare.mutate()}
              >
                Собрать заново
              </Button>
              {!everythingRead && (
                <span className="pr-muted">Откройте обе версии — они уходят поставщику первыми.</span>
              )}
            </div>
          ) : (
            <p className="pr-muted">Для согласования RFQ требуется разрешение CARD_WRITE.</p>
          )}
        </>
      )}
    </section>
  )
}
