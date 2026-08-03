import React from 'react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Inbox, Refresh } from './icons'

export function LoadingState({ rows = 6 }) {
  return <div className="pr-loading" aria-label="Загрузка">{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="pr-skeleton--row" />)}</div>
}

export function ErrorState({ error, onRetry, title = 'Не удалось загрузить данные' }) {
  const message = error?.response?.data?.message || error?.message || 'Procurement service unavailable.'
  return <Alert variant="destructive"><AlertTriangle /><AlertTitle>{title}</AlertTitle><AlertDescription>{message}</AlertDescription>{onRetry && <AlertAction><Button variant="outline" size="sm" onClick={onRetry}><Refresh size={14} />Повторить</Button></AlertAction>}</Alert>
}

export function EmptyState({ title = 'Данных пока нет', description = 'Здесь появятся данные после начала закупочного процесса.', action }) {
  return <div className="pr-empty"><Inbox size={28} /><h3>{title}</h3><p>{description}</p>{action}</div>
}
