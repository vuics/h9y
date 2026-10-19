import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, MessageSquare } from './icons'

const KIND_LABEL = { PROCUREMENT: 'Ассистент закупок', NEGOTIATOR: 'Переговорщик' }

const mutationMessage = error =>
  error?.response?.data?.message || error?.response?.data?.detail?.message || error?.message

/** Which organization each agent works for.
 *
 * For administrators and the operator only: an agent carries its owner's
 * model keys and marketplace account, so the API decides who may move which
 * one, and this card only offers what the API said is allowed. An agent
 * working for an organization the reader does not belong to shows as
 * "другая организация", never by name.
 */
export function AgentBindingCard() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: procurementKeys.organizationAgents(),
    queryFn: ({ signal }) => procurementApi.organizationAgents(signal),
  })
  const bind = useMutation({
    mutationFn: procurementApi.bindAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.organizationAgents() }),
  })
  if (!query.data) return null
  const { agents, organizations } = query.data

  const choose = (agent, organizationId) => {
    const target = organizationId || null
    const current = agent.organization?.id || null
    if (target === current) return
    const name = organizations.find(item => item.id === target)?.name
    const question = target
      ? `«${agent.name}» будет работать на «${name}»${current ? ' вместо текущей организации' : ''}. Продолжить?`
      : `«${agent.name}» перестанет работать на организацию. Продолжить?`
    if (window.confirm(question)) bind.mutate({ agentId: agent.id, organizationId: target })
  }

  return <Card><CardHeader><CardTitle><MessageSquare /> Агенты организации</CardTitle></CardHeader><CardContent>
    <p className="pr-note">
      Агент работает с данными одной организации: её карточками, поставщиками,
      перепиской и её аккаунтом Echemi. Если владелец агента состоит в одной
      организации, агент работает на неё сам; если в нескольких — выберите здесь.
      Изменение действует со следующего сообщения агенту.
    </p>
    {agents.length === 0
      ? <p className="pr-note">В ваших организациях пока нет агентов. Разверните агента закупок и переговорщика, и они появятся здесь.</p>
      : <div className="pr-agent-bindings">{agents.map(agent => {
        const hidden = agent.organization?.hidden
        return <div key={agent.id} className="pr-agent-binding">
          <span>
            <strong>{agent.name}</strong> <span className="pr-note">{KIND_LABEL[agent.kind] || agent.kind}</span>
            {!agent.deployed && <> <Badge variant="outline">выключен</Badge></>}
            {agent.owner && <span className="pr-note"> · {agent.ownedByMe ? 'ваш' : agent.owner}</span>}
          </span>
          <label className="pr-form-field">
            <span className="pr-sr-only">Организация агента {agent.name}</span>
            {hidden
              ? <select disabled value="hidden"><option value="hidden">Другая организация</option></select>
              : <select
                value={agent.organization?.id || ''}
                disabled={bind.isPending}
                onChange={event => choose(agent, event.target.value)}
              >
                <option value="">— не работает ни на одну —</option>
                {organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>}
          </label>
          <span className="pr-note">
            {hidden
              ? 'Работает на организацию, в которой вы не состоите; перенести может оператор.'
              : agent.binding === 'OWNER'
                ? 'Определена по владельцу'
                : agent.binding === 'NONE'
                  ? 'Не работает: владелец в нескольких организациях или ни в одной'
                  : 'Выбрана явно'}
          </span>
        </div>
      })}</div>}
    {bind.isError && <Alert><AlertTriangle /><AlertTitle>Не удалось изменить</AlertTitle><AlertDescription>{mutationMessage(bind.error)}</AlertDescription></Alert>}
  </CardContent></Card>
}
