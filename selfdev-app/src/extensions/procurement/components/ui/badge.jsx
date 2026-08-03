import React from 'react'
import { cn } from './utils'

export function Badge({ className, tone = 'neutral', children, ...props }) {
  return <span className={cn('pr-badge', `pr-badge--${tone}`, className)} {...props}>{children}</span>
}
