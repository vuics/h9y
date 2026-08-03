import React from 'react'
import { cn } from './utils'

export function Alert({ className, tone = 'info', icon, title, children, actions }) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('pr-alert', `pr-alert--${tone}`, className)}>
    {icon && <div className="pr-alert__icon">{icon}</div>}
    <div><div className="pr-alert__title">{title}</div>{children && <div className="pr-alert__body">{children}</div>}</div>
    {actions && <div className="pr-alert__actions">{actions}</div>}
  </div>
}
