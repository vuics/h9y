import React from 'react'
import { Badge } from './ui/badge'
import { AlertTriangle, Check, CircleAlert, Clock } from './icons'

const labels = {
  NEW: 'Новая', NORMALIZED: 'Нормализовано', NEEDS_REVIEW: 'Нужна проверка',
  AWAITING_APPROVAL: 'Ждёт согласования', APPROVED: 'Согласовано',
  SOURCING: 'Поиск', NEGOTIATION: 'Переговоры', WAITING_SUPPLIER: 'Ждём поставщика', COMPARISON: 'Сравнение',
  READY: 'Готово', QUEUED: 'В очереди', IN_PROGRESS: 'В работе', COMPLETE: 'Завершено', FAILED: 'Ошибка', ESCALATED: 'Эскалация', STALE: 'Устарело', CANCELLED: 'Отменено',
  UNVERIFIED: 'Не проверен', UNDER_REVIEW: 'На проверке', QUALIFIED: 'Квалифицирован', SUSPENDED: 'Приостановлен', REJECTED: 'Отклонён',
  NEEDS_CLARIFICATION: 'Нужно уточнение', CONFLICTING: 'Противоречия', NEEDS_HUMAN_REVIEW: 'Нужен специалист',
  OPEN: 'Открыта', IN_REVIEW: 'На рассмотрении', RECOMMENDED: 'Есть рекомендация', RESOLVED: 'Решена',
  MATCHED: 'Совпадает', MISMATCH: 'Не совпадает', UNVERIFIED_IDENTITY: 'Не подтверждено',
  PRESENT: 'Подтверждено', UNKNOWN: 'Нет данных', AMBIGUOUS: 'Неоднозначно', CONFLICT: 'Противоречие', INVALID: 'Некорректно',
  PROVIDED: 'Получен', CLAIMED_ATTACHED: 'Заявлен во вложении', CLAIMED_AVAILABLE: 'Доступен по запросу', NOT_AVAILABLE: 'Недоступен',
  DELIVERED: 'Доставлено', RECEIVED: 'Получено', PROCESSED: 'Обработано', RECORDED: 'Зафиксировано',
}

const complete = new Set(['NORMALIZED', 'APPROVED', 'COMPLETE', 'QUALIFIED', 'RESOLVED', 'MATCHED', 'PRESENT', 'PROVIDED', 'DELIVERED', 'PROCESSED'])
const warning = new Set(['NEEDS_REVIEW', 'AWAITING_APPROVAL', 'NEEDS_CLARIFICATION', 'UNDER_REVIEW', 'CLAIMED_ATTACHED', 'CLAIMED_AVAILABLE', 'AMBIGUOUS'])
const danger = new Set(['FAILED', 'ESCALATED', 'CONFLICTING', 'NEEDS_HUMAN_REVIEW', 'MISMATCH', 'CONFLICT', 'INVALID', 'REJECTED'])
const waiting = new Set(['WAITING_SUPPLIER', 'QUEUED', 'OPEN', 'IN_REVIEW'])

export function statusTone(status) {
  if (complete.has(status)) return 'complete'
  if (danger.has(status)) return 'danger'
  if (warning.has(status)) return 'warning'
  if (waiting.has(status)) return 'waiting'
  if (['STALE', 'CANCELLED', 'SUSPENDED', 'UNKNOWN', 'UNVERIFIED', 'NOT_AVAILABLE'].includes(status)) return 'muted'
  return 'progress'
}

export function StatusBadge({ status, label, compact = false }) {
  const tone = statusTone(status)
  const StatusIcon = tone === 'complete' ? Check : tone === 'danger' ? CircleAlert : tone === 'warning' ? AlertTriangle : Clock
  return <Badge tone={tone} title={status}><StatusIcon size={compact ? 12 : 13} />{label || labels[status] || status || 'Неизвестно'}</Badge>
}

export const statusLabel = status => labels[status] || status || 'Неизвестно'
