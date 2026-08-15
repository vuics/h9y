import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { KIND_LABELS, TOPIC_LABELS, STAGE_LABELS, GUARD_LABELS } from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CircleAlert, MessageSquare, Plus, Sliders } from '../components/icons'

const KIND_ORDER = ['DIRECTIVE', 'BLOCK', 'LOCKED_CLAUSE']

const KIND_HINTS = {
  DIRECTIVE: 'Инструкции агенту своими словами. Попадают в промпт; часть из них дополнительно проверяется автоматически.',
  BLOCK: 'Позиция компании по типовым вопросам поставщиков из ТЗ 5.5. Агент отвечает из блока или не отвечает на тему вовсе.',
  LOCKED_CLAUSE: 'Дословный текст. Сообщение без него не уходит поставщику.',
}

function ScopeSummary({ scope }) {
  const parts = []
  if (scope?.stages?.length) parts.push(scope.stages.map(stage => STAGE_LABELS[stage] || stage).join(', '))
  if (scope?.countries?.length) parts.push(`страны: ${scope.countries.join(', ')}`)
  if (scope?.channels?.length) parts.push(`каналы: ${scope.channels.join(', ')}`)
  if (scope?.supplierIds?.length) parts.push(`поставщиков: ${scope.supplierIds.length}`)
  if (scope?.cardIds?.length) parts.push(`карточек: ${scope.cardIds.length}`)
  return <span className="pr-playbook-scope">{parts.length ? parts.join(' · ') : 'Действует везде'}</span>
}

function ItemRow({ item, canWrite, onToggle, toggling }) {
  return (
    <li className={`pr-playbook-item${item.enabled ? '' : ' pr-playbook-item--off'}`}>
      <div className="pr-playbook-item__head">
        <Link to={`/procurement/communication/playbook/${item.itemId}`}>{item.title}</Link>
        <div className="pr-inline-actions">
          {item.topic && <Badge>{TOPIC_LABELS[item.topic] || item.topic}</Badge>}
          {item.verbatim && <Badge variant="outline">дословно</Badge>}
          {item.language !== 'any' && <Badge variant="outline">{item.language.toUpperCase()}</Badge>}
          <Badge variant="outline">v{item.version}</Badge>
        </div>
      </div>
      <p className="pr-playbook-item__body">{item.body}</p>
      <div className="pr-playbook-item__meta">
        <ScopeSummary scope={item.scope} />
        {item.forbidsDisclosure?.length > 0 && (
          <span className="pr-playbook-guard">
            не раскрывать: {item.forbidsDisclosure.map(guard => GUARD_LABELS[guard] || guard).join(', ')}
          </span>
        )}
        {canWrite && (
          <Button variant="ghost" size="sm" isDisabled={toggling} onPress={() => onToggle(item)}>
            {item.enabled ? 'Выключить' : 'Включить'}
          </Button>
        )}
      </div>
      {item.needsCustomerReview && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Не заполнено</AlertTitle>
          <AlertDescription>
            Это заготовка, а не реальный ответ компании. Пока она не заполнена, агент не будет отвечать на эту тему,
            а сообщение с оставшимся маркером не будет отправлено.
          </AlertDescription>
        </Alert>
      )}
    </li>
  )
}

export default function PlaybookPage() {
  const queryClient = useQueryClient()
  const { canWritePlaybook: canWrite } = useProcurementPermissions()
  const [kind, setKind] = useState(null)

  const query = useQuery({
    queryKey: procurementKeys.playbook({ kind }),
    queryFn: ({ signal }) => procurementApi.playbook(kind ? { kind } : {}, signal),
  })
  const toggle = useMutation({
    mutationFn: item => procurementApi.updatePlaybookItem(item.itemId, {
      enabled: !item.enabled,
      summary: item.enabled ? 'Выключено в библиотеке' : 'Включено в библиотеке',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.all }),
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const items = query.data?.items || []
  const counts = query.data?.counts || {}
  const unfilled = query.data?.needsCustomerReview || 0

  return (
    <div className="pr-stack">
      <div className="pr-section-heading">
        <div>
          <h2>Библиотека коммуникации</h2>
          <p>
            Чем агент руководствуется, когда пишет поставщику. Модель отвечает за формулировки,
            библиотека — за факты компании, её политику и обязательные фразы.
          </p>
        </div>
        <div className="pr-inline-actions">
          <RouterLinkButton to="/procurement/communication/policy" variant="outline" size="sm">
            <Sliders size={15} />Политика проверки
          </RouterLinkButton>
          <RouterLinkButton to="/procurement/communication/drafts" variant="outline" size="sm">
            <MessageSquare size={15} />Черновики и отправленные
          </RouterLinkButton>
          {canWrite && (
            <RouterLinkButton to="/procurement/communication/playbook/new" size="sm">
              <Plus size={15} />Добавить
            </RouterLinkButton>
          )}
        </div>
      </div>

      {unfilled > 0 && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Заготовок без ответа: {unfilled}</AlertTitle>
          <AlertDescription>
            Блоки ответов поставляются как пустые заготовки — реальные ответы знает только заказчик.
            Пока блок не заполнен, агент не станет отвечать на эту тему от имени компании.
          </AlertDescription>
        </Alert>
      )}

      {toggle.isError && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Изменение не сохранено</AlertTitle>
          <AlertDescription>{toggle.error?.response?.data?.message || toggle.error?.message}</AlertDescription>
        </Alert>
      )}

      <div className="pr-inline-actions">
        <Button variant={kind ? 'outline' : 'secondary'} size="sm" onPress={() => setKind(null)}>Все</Button>
        {KIND_ORDER.map(value => (
          <Button key={value} variant={kind === value ? 'secondary' : 'outline'} size="sm" onPress={() => setKind(value)}>
            {KIND_LABELS[value]}{counts[value] != null ? ` (${counts[value]})` : ''}
          </Button>
        ))}
      </div>

      {KIND_ORDER.filter(value => !kind || value === kind).map(value => {
        const group = items.filter(item => item.kind === value)
        return (
          <Card key={value}>
            <CardHeader>
              <CardTitle>{KIND_LABELS[value]}</CardTitle>
              <p className="pr-muted">{KIND_HINTS[value]}</p>
            </CardHeader>
            <CardContent>
              {group.length === 0
                ? <EmptyState title="Пока пусто" description="Добавьте первый элемент этого типа." />
                : <ul className="pr-playbook-list">
                  {group.map(item => (
                    <ItemRow
                      key={item.itemId}
                      item={item}
                      canWrite={canWrite}
                      onToggle={toggle.mutate}
                      toggling={toggle.isPending}
                    />
                  ))}
                </ul>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
