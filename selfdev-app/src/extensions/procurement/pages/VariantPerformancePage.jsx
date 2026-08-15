import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { STAGE_LABELS } from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CircleAlert } from '../components/icons'

const STAGES = ['FIRST_CONTACT', 'CLARIFICATION', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSING']

const percent = value => (value == null ? '—' : `${Math.round(value * 100)}%`)

export default function VariantPerformancePage() {
  const [stage, setStage] = useState('FIRST_CONTACT')
  const query = useQuery({
    queryKey: procurementKeys.variantPerformance({ stage }),
    queryFn: ({ signal }) => procurementApi.variantPerformance(stage ? { stage } : {}, signal),
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const rows = query.data?.rows || []
  const anyReliable = rows.some(row => row.reliable)

  return (
    <DetailLayout
      backTo="/procurement/communication"
      backLabel="Библиотека коммуникации"
      eyebrow="Коммуникация"
      title="Отклик на сообщения"
    >
      <Card>
        <CardHeader>
          <CardTitle>Какая формулировка работает</CardTitle>
          <p className="pr-muted">
            Доля ответов и доля дошедших до котировки по каждому варианту правила. Это та самая
            конверсия первичных и повторных запросов в квоты, которую требует ТЗ — считать её
            задним числом нельзя, поэтому цифры копятся с первого отправленного сообщения.
          </p>
          <p className="pr-muted">{query.data?.attributionNote}</p>
        </CardHeader>
        <CardContent>
          <div className="pr-inline-actions">
            <Button variant={stage ? 'outline' : 'secondary'} size="sm" onPress={() => setStage(null)}>
              Все стадии
            </Button>
            {STAGES.map(value => (
              <Button
                key={value}
                size="sm"
                variant={stage === value ? 'secondary' : 'outline'}
                onPress={() => setStage(value)}
              >
                {STAGE_LABELS[value] || value}
              </Button>
            ))}
          </div>

          {!anyReliable && rows.length > 0 && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Данных пока мало</AlertTitle>
              <AlertDescription>
                Ни один вариант не набрал {query.data?.minSample} отправленных сообщений.
                Разница между формулировками на таком объёме — шум, а не результат.
              </AlertDescription>
            </Alert>
          )}

          {rows.length === 0
            ? <EmptyState
              title="Отправленных сообщений ещё нет"
              description="Строки появятся, когда агент отправит первые сообщения поставщикам."
            />
            : <div className="pr-comparison-wrap">
              <table className="pr-comparison">
                <thead>
                  <tr>
                    <th>Правило и вариант</th>
                    <th>Отправлено</th>
                    <th>Ответили</th>
                    <th>Доля ответов</th>
                    <th>Дошли до котировки</th>
                    <th>Конверсия в квоты</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={`${row.itemId}-${row.variantId || 'base'}`} className={row.reliable ? undefined : 'pr-row--weak'}>
                      <th>
                        <Link to={`/procurement/communication/playbook/${row.itemId}`}>
                          {row.itemTitle}
                        </Link>
                        <Badge variant="outline">{row.variantLabel}</Badge>
                        {!row.reliable && <Badge variant="outline">мало данных</Badge>}
                      </th>
                      <td>{row.sent}</td>
                      <td>{row.replied}</td>
                      <td><strong>{percent(row.replyRate)}</strong></td>
                      <td>{row.quoted}</td>
                      <td><strong>{percent(row.quoteRate)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </CardContent>
      </Card>
    </DetailLayout>
  )
}
