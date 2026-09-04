import React, { useState } from 'react'
import { Link } from 'react-router-dom'

import { RfqApproval } from './RfqApproval'
import { StatusBadge, statusLabel } from './StatusBadge'
import { escalationActions, escalationOutcomes } from '../api/escalations'
import { CHANGE_FIELD_LABELS } from '../lib/thread'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Clock } from './icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** One status change, when it is worth a line of its own. */
export function StatusLine({ event }) {
  return (
    <p className="pr-sysline">
      <span>{formatDate(event.changedAt)}</span>
      <strong>
        {event.fromStatus && event.fromStatus !== event.toStatus
          ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
          : statusLabel(event.toStatus)}
      </strong>
      <span className="pr-muted">
        {event.source}{event.reason ? ` · ${event.reason}` : ''}
        {event.actorPrincipalKey ? ` · ${event.actorPrincipalKey}` : ''}
      </span>
    </p>
  )
}

/** A run of the machine's own bookkeeping, folded until someone asks. */
export function StatusGroup({ events }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pr-sysgroup">
      <button type="button" className="pr-link-button" onClick={() => setOpen(current => !current)}>
        {open ? 'Скрыть' : 'Показать'} системные события · {events.length}
      </button>
      {open && events.map((event, index) => (
        <StatusLine key={`${event.changedAt}-${index}`} event={event} />
      ))}
    </div>
  )
}

/** An open escalation, answered without leaving the conversation.
 *
 * The decision is the same one the escalation page takes, and it is taken here
 * because the evidence for it — the two contradictory quotations — is three
 * lines above.
 */
export function EscalationEvent({ escalation, actions, permissions }) {
  const [decision, setDecision] = useState('')
  const [resolution, setResolution] = useState('REQUEST_CLARIFICATION')
  const available = escalationActions(escalation.status)
  const pending = actions.pendingEscalation === escalation.id
  return (
    <section className="pr-tevent pr-tevent--danger">
      <header>
        <AlertTriangle size={15} />
        <strong>{escalation.title || 'Эскалация'}</strong>
        <StatusBadge status={escalation.status} compact />
        <time>{formatDate(escalation.createdAt)}</time>
      </header>
      <p>{escalation.recommendation}</p>
      {escalation.risks?.length > 0 && (
        <ul className="pr-tevent__risks">
          {escalation.risks.map((risk, index) => (
            <li key={`${risk.code}-${index}`}><strong>{risk.code}</strong> · {risk.reason}</li>
          ))}
        </ul>
      )}
      {available.canClaim && permissions.canClaimEscalations && (
        <Button size="sm" variant="outline" isDisabled={pending} onPress={() => actions.claim(escalation.id)}>
          Взять в работу
        </Button>
      )}
      {available.canResolve && permissions.canResolveEscalations && (
        <div className="pr-tevent__resolve">
          <label className="pr-form-field">
            <span>Решение</span>
            <select value={resolution} onChange={event => setResolution(event.target.value)}>
              {escalationOutcomes.map(outcome => (
                <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
              ))}
            </select>
          </label>
          <Textarea
            rows={2}
            value={decision}
            placeholder="Основание решения: какие факты проверены."
            onChange={event => setDecision(event.target.value)}
          />
          <Button
            size="sm"
            isDisabled={!decision.trim() || pending}
            onPress={() => actions.resolve(escalation.id, { resolution, decision: decision.trim() })}
          >
            Принять решение
          </Button>
        </div>
      )}
      <Link to={`/procurement/escalations/${escalation.id}`}>Карточка эскалации</Link>
    </section>
  )
}

/** The requirement moved: what changed, what it costs, and the three ways out.
 *
 * The negotiation is not over — the supplier, the history and the contact are
 * all still here — so this asks one question instead of silently ending it.
 */
export function CardChangeEvent({
  change, negotiation, actions, canDecide = false, canApproveRfq = false,
}) {
  const decided = Boolean(change.resolution)
  const preparing = change.draftStatus === 'PREPARING'
  const pending = actions.pendingCardChange
  return (
    <section className={`pr-tevent pr-tevent--warning${decided ? ' pr-tevent--decided' : ''}`}>
      <header>
        <AlertTriangle size={15} />
        <strong>Параметры карточки изменились</strong>
        <time>{formatDate(change.detectedAt)}</time>
      </header>
      {change.changedFields.length > 0 ? (
        <table className="pr-diff">
          <thead><tr><th>Параметр</th><th>Было</th><th>Стало</th></tr></thead>
          <tbody>
            {change.changedFields.map(field => (
              <tr key={field.field}>
                <td>{CHANGE_FIELD_LABELS[field.field] || field.field}</td>
                <td className="pr-diff__old">{field.before || 'не указано'}</td>
                <td className="pr-diff__new">{field.after || 'не указано'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pr-muted">
          Требование изменилось до того, как задание начало сохранять снимок параметров,
          поэтому разницу показать не из чего. Сверьтесь с карточкой закупки.
        </p>
      )}
      <p>
        Переговоры приостановлены: сообщения по прежним требованиям не отправляются, а
        полученные ранее предложения помечены как данные по старым условиям.
      </p>
      {/* The RFQ is what is actually holding this up, so it is signed here
          rather than on a page the specialist has to go and find. */}
      {!change.rfqApproved && !decided && (
        <RfqApproval cardId={negotiation.cardId} canApprove={canApproveRfq} />
      )}
      {change.rfqApproved && (
        <p className="pr-muted">
          <Link to={`/procurement/requests/${negotiation.cardId}/rfq`}>
            RFQ {change.currentRfqId || negotiation.rfqId} утверждён
          </Link>{' '}— переговоры можно продолжать.
        </p>
      )}
      {preparing && (
        <p className="pr-muted pr-tevent__preparing">
          <Clock size={13} /> Черновик уведомления готовится — он появится ниже, в
          запланированных сообщениях.{' '}
          {canDecide && (
            <button type="button" className="pr-link-button" onClick={() => actions.prepareDraft()}>
              Подготовить сейчас
            </button>
          )}
        </p>
      )}
      {change.draftStatus === 'FAILED' && (
        <p className="pr-muted">Черновик не удалось подготовить: {change.draftError}</p>
      )}
      {decided ? (
        <p className="pr-muted">
          Решение: {{
            CONTINUE: 'продолжить в этом треде',
            RESTART: 'начать переговоры заново',
            STOP: 'остановить переговоры',
          }[change.resolution]} · {formatDate(change.resolvedAt)}
        </p>
      ) : canDecide && (
        <div className="pr-inline-actions">
          <Button
            size="sm"
            isDisabled={!change.rfqApproved || pending}
            onPress={() => actions.resolveCardChange('CONTINUE')}
          >
            Продолжить в этом треде
          </Button>
          <Button size="sm" variant="outline" isDisabled={pending} onPress={() => actions.resolveCardChange('RESTART')}>
            Начать заново
          </Button>
          <Button size="sm" variant="outline" isDisabled={pending} onPress={() => actions.resolveCardChange('STOP')}>
            Остановить переговоры
          </Button>
          {!change.rfqApproved && (
            <span className="pr-muted">
              «Продолжить» станет доступно, когда новый RFQ будет утверждён.
            </span>
          )}
        </div>
      )}
    </section>
  )
}
