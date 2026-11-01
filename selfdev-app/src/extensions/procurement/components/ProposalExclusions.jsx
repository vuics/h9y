import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from './icons'
import { StatusBadge } from './StatusBadge'

const quoteLabel = quote => [
  [quote.price, quote.currency].filter(Boolean).join(' ') || 'Цена не указана',
  quote.priceUnit && `за ${quote.priceUnit}`,
  [quote.incoterm, quote.namedPlace].filter(Boolean).join(' '),
].filter(Boolean).join(' · ')

const failureText = error => error?.response?.data?.message || error?.message

/** One press, then a reason: nothing is set aside without saying why. */
function SetAside({ label, placeholder, isPending, onConfirm }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <Button size="sm" variant="outline" onPress={() => setOpen(true)}>{label}</Button>
  return <div className="pr-inline-actions">
    <Input autoFocus value={reason} placeholder={placeholder} aria-label="Причина" onChange={event => setReason(event.target.value)} />
    <Button size="sm" isDisabled={!reason.trim() || isPending} onPress={() => onConfirm(reason.trim())}>{label}</Button>
    <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>Отмена</Button>
  </div>
}

/** Take a wrongly read price, or the whole offer, out of consideration.
 *
 * What the supplier wrote stays on file; the comparison and the purchase stop
 * counting it, and either can be brought back.
 */
export function ProposalExclusions({ proposal, canEdit = false }) {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  const exclude = useMutation({
    mutationFn: ({ reason, quoteIndex }) => procurementApi.excludeProposal(proposal.id, reason, quoteIndex),
    onSuccess,
  })
  const restore = useMutation({
    mutationFn: quoteIndex => procurementApi.restoreProposal(proposal.id, quoteIndex),
    onSuccess,
  })
  const pending = exclude.isPending || restore.isPending
  const failure = exclude.error || restore.error
  const quotes = proposal.quotes || []

  return <Card>
    <CardHeader><CardTitle>Цены в этом предложении</CardTitle></CardHeader>
    <CardContent>
      <p className="pr-note">Если система прочитала письмо неверно, например взяла цену другого вещества, уберите цену или всё предложение. Текст письма сохранится, сравнение и закупка перестанут это учитывать.</p>
      {failure && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Действие не выполнено</AlertTitle><AlertDescription>{failureText(failure)}</AlertDescription></Alert>}
      {quotes.length > 0 && <ul className="pr-plain-list">{quotes.map(quote => <li key={quote.index} className="pr-inline-actions">
        <span>{quoteLabel(quote)}</span>
        {quote.excluded && <StatusBadge status="muted" tone="muted" label={`убрана: ${quote.excluded.reason}`} compact />}
        {canEdit && (quote.excluded
          ? <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => restore.mutate(quote.index)}>Вернуть</Button>
          : <SetAside label="Убрать цену" placeholder="Например: цена другого вещества" isPending={pending} onConfirm={reason => exclude.mutate({ reason, quoteIndex: quote.index })} />)}
      </li>)}</ul>}
      {canEdit && <div className="pr-inline-actions">
        {proposal.excluded
          ? <Button size="sm" variant="outline" isDisabled={pending} onPress={() => restore.mutate(undefined)}>Вернуть предложение</Button>
          : <SetAside label="Исключить предложение" placeholder="Например: подозрительный поставщик" isPending={pending} onConfirm={reason => exclude.mutate({ reason })} />}
      </div>}
    </CardContent>
  </Card>
}
