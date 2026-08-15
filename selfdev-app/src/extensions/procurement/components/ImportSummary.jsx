import React from 'react'

import { AlertTriangle, Check } from './icons'

export function SummaryChips({ summary }) {
  const chips = [
    ['Всего строк', summary.totalRows, 'neutral'],
    ['Готовы полностью', summary.ready, 'good'],
    ['Черновики', summary.draft, 'warn'],
    ['Дубли', summary.duplicate, 'warn'],
    ['Не опознаны', summary.unidentified, 'bad'],
    ['Пустые', summary.empty, 'muted'],
    ['Исправлено значений', summary.repairedRows, 'neutral'],
  ].filter(([, value]) => value > 0 || value === summary.totalRows)
  return (
    <ul className="pr-import-chips">
      {chips.map(([label, value, tone]) => (
        <li key={label} className={`is-${tone}`}><b>{value}</b><span>{label}</span></li>
      ))}
    </ul>
  )
}


export function RowIssues({ row }) {
  if (!row.repairs.length && !row.issues.length) return null
  return (
    <ul className="pr-import-row-notes">
      {row.repairs.map((note, index) => (
        <li key={`r${index}`} className="is-repair"><Check size={12} />{note}</li>
      ))}
      {row.issues.map((note, index) => (
        <li key={`i${index}`} className="is-issue"><AlertTriangle size={12} />{note}</li>
      ))}
    </ul>
  )
}
