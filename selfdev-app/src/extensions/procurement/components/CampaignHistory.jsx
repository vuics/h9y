import React, { useMemo, useState } from 'react'
import { historyLevels, historyLine } from '../lib/campaignHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectField } from './SelectField'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const formatTime = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** What happened to a campaign, newest first. */
export function CampaignHistory({ events = [], members = [] }) {
  const [level, setLevel] = useState('main')
  const [cardId, setCardId] = useState('all')

  const lines = useMemo(() => events
    .map(event => ({ event, ...historyLine(event) }))
    .filter(line => level === 'all' || line.main)
    .filter(line => cardId === 'all' || String(line.event.cardId) === cardId), [events, level, cardId])

  return <Card className="pr-campaign-history"><CardHeader><div>
    <CardTitle>История кампании</CardTitle>
    <p>Кто и что сделал, в каком порядке. Шаги по каждому веществу — в «Все события».</p>
  </div></CardHeader><CardContent>
    <div className="pr-inline-actions pr-campaign-history__filters">
      {Object.entries(historyLevels).map(([id, label]) => <label key={id} className={level === id ? 'is-selected' : undefined}>
        <input type="radio" name="campaign-history-level" checked={level === id} onChange={() => setLevel(id)} />
        <span>{label}</span>
      </label>)}
      {level === 'all' && members.length > 1 && <SelectField label="Вещество" selectedKey={cardId} onSelectionChange={key => setCardId(String(key))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem id="all">Все вещества</SelectItem>
          {members.map(member => <SelectItem key={member.cardId} id={String(member.cardId)}>{member.title}</SelectItem>)}
        </SelectContent>
      </SelectField>}
    </div>
    {lines.length === 0
      ? <p className="pr-note">{events.length ? 'Под выбранный фильтр ничего не попало.' : 'История ведётся с этого обновления — у кампании, запущенной раньше, она начинается с первого нового события.'}</p>
      : <ol className="pr-campaign-history__list">{lines.map(({ event, text, who }, index) => <li key={`${event.at}-${index}`} className={event.kind === 'SEARCH_FAILED' || (event.data?.errors || []).length ? 'is-problem' : undefined}>
        <time>{formatTime(event.at)}</time>
        <span>{text}</span>
        <em title={event.actor || undefined}>{who}</em>
      </li>)}</ol>}
  </CardContent></Card>
}
