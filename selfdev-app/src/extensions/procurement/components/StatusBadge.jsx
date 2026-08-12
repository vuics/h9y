import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Check, CircleAlert, Clock } from './icons'

const labels = {
  NEW: 'Новая', NORMALIZED: 'Нормализовано', NEEDS_REVIEW: 'Нужна проверка',
  DRAFT: 'Черновик', ANALYZING: 'Разбираем файл', AWAITING_CONFIRMATION: 'Ждёт подтверждения',
  CREATING: 'Создаём карточки', NORMALIZING: 'Сверяем с PubChem',
  DUPLICATE: 'Дубль', EMPTY: 'Пустая строка', UNIDENTIFIED: 'Не опознана',
  CREATED: 'Создана', SKIPPED: 'Пропущена', NOT_FOUND: 'Не найдено в PubChem',
  AWAITING_APPROVAL: 'Ждёт согласования', APPROVED: 'Согласовано',
  SOURCING: 'Поиск', NEGOTIATION: 'Переговоры', WAITING_SUPPLIER: 'Ждём поставщика', COMPARISON: 'Сравнение',
  READY: 'Готово', QUEUED: 'В очереди', IN_PROGRESS: 'В работе', COMPLETE: 'Завершено', FAILED: 'Ошибка', ESCALATED: 'Эскалация', STALE: 'Устарело', CANCELLED: 'Остановлено',
  UNVERIFIED: 'Не проверен', UNDER_REVIEW: 'На проверке', QUALIFIED: 'Квалифицирован', SUSPENDED: 'Приостановлен', REJECTED: 'Отклонён',
  NEEDS_CLARIFICATION: 'Нужно уточнение', CONFLICTING: 'Противоречия', NEEDS_HUMAN_REVIEW: 'Нужен специалист',
  OPEN: 'Открыта', IN_REVIEW: 'На рассмотрении', RECOMMENDED: 'Есть рекомендация', RESOLVED: 'Решена',
  MATCHED: 'Совпадает', MISMATCH: 'Не совпадает', UNVERIFIED_IDENTITY: 'Не подтверждено',
  PRESENT: 'Подтверждено', UNKNOWN: 'Нет данных', AMBIGUOUS: 'Неоднозначно', CONFLICT: 'Противоречие', INVALID: 'Некорректно',
  PROVIDED: 'Получен', CLAIMED_ATTACHED: 'Заявлен во вложении', CLAIMED_AVAILABLE: 'Доступен по запросу', NOT_AVAILABLE: 'Недоступен',
  DELIVERED: 'Доставлено', RECEIVED: 'Получено', PROCESSED: 'Обработано', RECORDED: 'Зафиксировано',
  RUNNING: 'Поиск выполняется', COMPLETED: 'Поиск завершён',
  GREEN: 'Высокая уверенность', YELLOW: 'Нужны доказательства', RED: 'Высокий риск',
  UNREVIEWED: 'Не рассмотрен', VERIFIED_MANUFACTURER: 'Производитель подтверждён', VERIFIED_DISTRIBUTOR: 'Дистрибьютор подтверждён', NEEDS_MORE_EVIDENCE: 'Нужны доказательства',
  MANUFACTURER: 'Производитель', DISTRIBUTOR: 'Дистрибьютор', BOTH: 'Производитель и дистрибьютор',
  OFFICIAL_COMPANY: 'Сайт компании', GOVERNMENT_REGISTRY: 'Государственный реестр', REGULATOR: 'Регулятор', MARKETPLACE: 'B2B-площадка', TRADE_DIRECTORY: 'Отраслевой каталог', NEWS: 'Новости', SEARCH_SNIPPET: 'Поисковая выдача', OTHER: 'Другой источник',
  POSITIVE: 'Подтверждает', NEGATIVE: 'Опровергает',
  ANALYZED: 'Есть доказательства', NO_EVIDENCE: 'Без доказательств', OFF_SUBJECT: 'Не про это вещество',
  EXTRACTION_FAILED: 'Ошибка анализа', EXTRACTION_TIMEOUT: 'Анализ не успел', BUDGET_EXHAUSTED: 'Не хватило времени прогона', PENDING: 'В очереди',
}

const complete = new Set(['NORMALIZED', 'APPROVED', 'COMPLETE', 'COMPLETED', 'QUALIFIED', 'RESOLVED', 'MATCHED', 'PRESENT', 'PROVIDED', 'DELIVERED', 'PROCESSED', 'GREEN', 'VERIFIED_MANUFACTURER', 'VERIFIED_DISTRIBUTOR', 'POSITIVE', 'ANALYZED', 'CREATED', 'READY'])
const warning = new Set(['NEEDS_REVIEW', 'AWAITING_APPROVAL', 'NEEDS_CLARIFICATION', 'UNDER_REVIEW', 'CLAIMED_ATTACHED', 'CLAIMED_AVAILABLE', 'AMBIGUOUS', 'YELLOW', 'NEEDS_MORE_EVIDENCE', 'EXTRACTION_TIMEOUT', 'BUDGET_EXHAUSTED', 'DRAFT', 'DUPLICATE', 'AWAITING_CONFIRMATION'])
const danger = new Set(['FAILED', 'ESCALATED', 'CONFLICTING', 'NEEDS_HUMAN_REVIEW', 'MISMATCH', 'CONFLICT', 'INVALID', 'REJECTED', 'RED', 'NEGATIVE', 'EXTRACTION_FAILED', 'UNIDENTIFIED'])
const waiting = new Set(['WAITING_SUPPLIER', 'QUEUED', 'OPEN', 'IN_REVIEW', 'PENDING', 'ANALYZING', 'CREATING', 'NORMALIZING'])

export function statusTone(status) {
  if (complete.has(status)) return 'complete'
  if (danger.has(status)) return 'danger'
  if (warning.has(status)) return 'warning'
  if (waiting.has(status)) return 'waiting'
  if (['STALE', 'CANCELLED', 'SUSPENDED', 'UNKNOWN', 'UNVERIFIED', 'UNREVIEWED', 'NOT_AVAILABLE', 'OFF_SUBJECT', 'NO_EVIDENCE', 'EMPTY', 'SKIPPED', 'NOT_FOUND'].includes(status)) return 'muted'
  return 'progress'
}

export function StatusBadge({ status, label, compact = false }) {
  const tone = statusTone(status)
  const StatusIcon = tone === 'complete' ? Check : tone === 'danger' ? CircleAlert : tone === 'warning' ? AlertTriangle : Clock
  const variant = tone === 'danger' ? 'destructive' : tone === 'complete' ? 'default' : tone === 'muted' ? 'secondary' : 'outline'
  return <Badge variant={variant} title={status}><StatusIcon size={compact ? 12 : 13} />{label || labels[status] || status || 'Неизвестно'}</Badge>
}

export const statusLabel = status => labels[status] || status || 'Неизвестно'
