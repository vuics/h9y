import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { importStatusLabels } from '../api/imports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from './StatusBadge'

export function RecentImports() {
  const query = useQuery({
    queryKey: procurementKeys.cardImports(),
    queryFn: ({ signal }) => procurementApi.cardImports(signal),
  })
  const items = query.data?.items || []
  if (query.isLoading || !items.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Недавние импорты</CardTitle></CardHeader>
      <CardContent>
        <ul className="pr-import-history">
          {items.map(item => (
            <li key={item.id}>
              <Link to={`/procurement/requests/import/${item.id}`}>
                <strong>{item.filename}</strong>
              </Link>
              <StatusBadge status={item.status} label={importStatusLabels[item.status]} compact />
              <span>
                строк: {item.totalRows} · создано: {item.createdCards}
                {item.failedRows ? ` · ошибок: ${item.failedRows}` : ''}
              </span>
              <small>{item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</small>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
