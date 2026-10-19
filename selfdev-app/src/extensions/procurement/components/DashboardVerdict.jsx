/** The first card on the manager's screen: is the agent better than a person.
 *
 * The rest of the dashboard looks back over a period in detail; this is the
 * line a head of sourcing reads first.
 */

import React from 'react'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { benchmarkVerdict, decimal } from '../lib/dashboard'

function verdictValue(value, unit) {
  if (value == null) return '—'
  return `${decimal(value)}${unit ? ` ${unit}` : ''}`
}

/** Is the agent better than a person: one sentence and four tiles.
 *
 * The detailed table, with where every number came from, stays in the
 * «Человек и агент» section; this is the line a manager reads first.
 */
export function VerdictCard({ data }) {
  const verdict = benchmarkVerdict(data)
  const actions = verdict.actions
  return (
    <Card>
      <CardHeader>
        <CardTitle>Агент и человек — коротко</CardTitle>
        <CardAction><a href="#human-and-agent">Подробно</a></CardAction>
        <p className="pr-verdict__headline">{verdict.headline}</p>
      </CardHeader>
      <CardContent>
        <div className="pr-verdict">
          {verdict.tiles.map(tile => (
            <div className="pr-verdict__tile" key={tile.key} data-improved={tile.improved == null ? undefined : String(tile.improved)}>
              <span>{tile.label}</span>
              <b>{verdictValue(tile.agent, tile.unit)}</b>
              <small>человек: {tile.human == null ? 'не введено' : verdictValue(tile.human, tile.unit)}</small>
              {tile.text && <em>{tile.text}</em>}
            </div>
          ))}
          {actions && (
            <div className="pr-verdict__tile">
              <span>Решений специалиста на позицию</span>
              <b>{actions.perCase == null ? '—' : decimal(actions.perCase)}</b>
              <small>всего {actions.total} за период · измерено</small>
              <em className="pr-verdict__neutral">стажёр делал бы и решения, и всю работу между ними</em>
            </div>
          )}
        </div>
        <p className="pr-chart-note">
          Позиций в работе за период: <b>{verdict.cases}</b>. Цифры агента измерены системой;
          цифры человека введены вручную.
        </p>
      </CardContent>
    </Card>
  )
}
