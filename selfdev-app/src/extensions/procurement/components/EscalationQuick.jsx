import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { escalationActions, escalationOutcomes } from '../api/escalations'
import { ESCALATION_CATEGORY_LABELS } from '../lib/escalation'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExternalLink } from './icons'

const mutationMessage = error => error?.response?.data?.detail?.message || error?.response?.data?.message || error?.message

/** An open escalation, decided without leaving the purchase.
 *
 * The same two presses the conversation offers — take it, then decide — over
 * the same API, folded under the escalation's line until asked for. What the
 * agent recommends and why are shown first: they are the evidence for the
 * decision. The full case stays one link away.
 */
export function EscalationQuick({ escalation, campaignId }) {
  const queryClient = useQueryClient()
  const { canClaimEscalations, canResolveEscalations } = useProcurementPermissions()
  const [resolution, setResolution] = useState('REQUEST_CLARIFICATION')
  const [decision, setDecision] = useState('')
  const settled = () => {
    queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'escalations'] })
    if (campaignId) queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
  }
  const claim = useMutation({ mutationFn: () => procurementApi.claimEscalation(escalation.id), onSuccess: settled })
  const resolve = useMutation({
    mutationFn: () => procurementApi.resolveEscalation(escalation.id, { resolution, decision: decision.trim() }),
    onSuccess: settled,
  })
  const available = escalationActions(escalation.status)
  const busy = claim.isPending || resolve.isPending
  const error = claim.error || resolve.error
  return <div className="pr-escalation-quick">
    {escalation.recommendation && <p>{escalation.recommendation}</p>}
    {escalation.risks?.length > 0 && <ul className="pr-tevent__risks">
      {escalation.risks.map((risk, index) => <li key={`${risk.code}-${index}`} title={risk.code}>
        <strong>{ESCALATION_CATEGORY_LABELS[risk.category] || 'Прочее'}</strong> · {risk.reason}
      </li>)}
    </ul>}
    {available.canClaim && canClaimEscalations && <div className="pr-inline-actions">
      <Button size="sm" variant="outline" isDisabled={busy} onPress={() => claim.mutate()}>{claim.isPending ? 'Берём…' : 'Взять в работу'}</Button>
      <span className="pr-muted">Решение принимает тот, кто взял эскалацию в работу.</span>
    </div>}
    {available.canResolve && canResolveEscalations && <div className="pr-escalation-quick__resolve">
      <select aria-label="Решение" value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy}>
        {escalationOutcomes.map(outcome => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}
      </select>
      <Textarea
        rows={2}
        value={decision}
        placeholder="Основание решения: какие факты проверены."
        onChange={event => setDecision(event.target.value)}
      />
      <div className="pr-inline-actions">
        <Button size="sm" isDisabled={!decision.trim() || busy} onPress={() => resolve.mutate()}>{resolve.isPending ? 'Принимаем…' : 'Принять решение'}</Button>
        <span className="pr-muted">«Остановить» отменяет переговоры, если других открытых эскалаций по ним нет.</span>
      </div>
    </div>}
    {!(available.canClaim && canClaimEscalations) && !(available.canResolve && canResolveEscalations) && <p className="pr-muted">
      Решить эту эскалацию отсюда нельзя: нужны права на эскалации или её взял в работу другой специалист.
    </p>}
    {error && <p className="pr-import-missing">{mutationMessage(error)}</p>}
    <p><Link to={`/procurement/escalations/${escalation.id}`}><ExternalLink size={12} /> Карточка эскалации — история и рекомендации</Link></p>
  </div>
}
