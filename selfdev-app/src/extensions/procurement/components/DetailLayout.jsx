import React from 'react'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { ArrowLeft } from './icons'
import { Separator } from '@/components/ui/separator'

export function DetailLayout({ backTo, backLabel, eyebrow, title, status, actions, meta, warnings, children }) {
  return <div className="pr-detail"><RouterLinkButton variant="ghost" size="sm" to={backTo}><ArrowLeft size={15} />{backLabel}</RouterLinkButton>
    <header className="pr-detail__header"><div><div className="pr-eyebrow">{eyebrow}</div><div className="pr-detail__title-row"><h1>{title}</h1>{status}</div>{meta && <div className="pr-detail__meta">{meta}</div>}</div>{actions && <div className="pr-detail__actions">{actions}</div>}</header>
    {warnings}<Separator />{children}</div>
}

export function DefinitionGrid({ items }) {
  return <dl className="pr-definitions">{items.filter(item => item.value != null && item.value !== '').map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
}
