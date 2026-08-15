import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import {
  importStatusLabels,
  isImportEditable,
  isImportRunning,
  selectableRows,
} from '../api/imports'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { ImportProgress } from '../components/ImportProgress'
import { ImportMappingEditor } from '../components/ImportMappingEditor'
import { ImportConfirmPanel } from '../components/ImportConfirmPanel'
import { ImportRowsTable } from '../components/ImportRowsTable'
import { RecentImports } from '../components/ImportRecentList'
import { SummaryChips } from '../components/ImportSummary'
import { UploadPanel } from '../components/ImportUploadPanel'
import { NormalizationPanel } from '../components/NormalizationPanel'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CircleAlert, Plus, Refresh } from '../components/icons'

// With a 300-row file, rendering every row at once is neither fast nor readable.
const VISIBLE_ROW_STEP = 50

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось выполнить операцию.'

export default function CardImportPage() {
  const { importId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleRows, setVisibleRows] = useState(VISIBLE_ROW_STEP)
  const [deselected, setDeselected] = useState(() => new Set())
  const [duplicatePolicy, setDuplicatePolicy] = useState('SKIP')

  const query = useQuery({
    queryKey: procurementKeys.cardImport(importId),
    queryFn: ({ signal }) => procurementApi.cardImport(importId, signal),
    enabled: Boolean(importId),
    refetchInterval: data => (isImportRunning(data) ? 1500 : false),
  })
  const run = query.data

  const accept = next => {
    queryClient.setQueryData(procurementKeys.cardImport(next.id), next)
    queryClient.invalidateQueries({ queryKey: procurementKeys.cardImports() })
    queryClient.invalidateQueries({ queryKey: procurementKeys.cards({}) })
  }

  const remap = useMutation({
    mutationFn: ({ index, field }) =>
      procurementApi.updateCardImportMapping(importId, [{ column_index: index, field }]),
    onSuccess: accept,
  })
  const confirm = useMutation({
    mutationFn: () => {
      const selected = selectableRows(run, duplicatePolicy)
        .filter(row => !deselected.has(row.rowNumber))
        .map(row => row.rowNumber)
      return procurementApi.confirmCardImport(importId, {
        duplicate_policy: duplicatePolicy,
        selected_row_numbers: selected,
      })
    },
    onSuccess: accept,
  })
  const normalize = useMutation({
    mutationFn: () => procurementApi.normalizeCardImport(importId),
    onSuccess: accept,
  })
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelCardImport(importId),
    onSuccess: accept,
  })

  // Reset the row window when the filter changes, so "show more" stays meaningful.
  useEffect(() => { setVisibleRows(VISIBLE_ROW_STEP) }, [statusFilter, importId])

  const rows = useMemo(() => {
    const all = run?.rows || []
    if (statusFilter === 'all') return all
    if (statusFilter.startsWith('NORMALIZATION:')) {
      const outcome = statusFilter.slice('NORMALIZATION:'.length)
      return all.filter(row => row.normalizationStatus === outcome)
    }
    return all.filter(row => row.status === statusFilter)
  }, [run, statusFilter])

  const statusCounts = useMemo(() => {
    const counts = {}
    for (const row of run?.rows || []) counts[row.status] = (counts[row.status] || 0) + 1
    return counts
  }, [run])

  const normalizationCounts = run?.normalization?.counts || {}
  const normalizationFilters = (run?.normalization?.outcomeOrder || [])
    .filter(outcome => normalizationCounts[outcome] > 0)

  const selectable = selectableRows(run, duplicatePolicy)
  const normalizationRunning = run?.normalization?.state === 'RUNNING'
  const selectedCount = selectable.filter(row => !deselected.has(row.rowNumber)).length

  if (!importId) {
    return (
      <div className="pr-stack">
        <RouterLinkButton to="/procurement/requests" variant="ghost" size="sm">
          <ArrowLeft size={15} />Карточки закупок
        </RouterLinkButton>
        <div className="pr-section-heading">
          <div>
            <h2>Массовое создание карточек</h2>
            <p>
              Загрузите файл со списком веществ. Система распознает структуру таблицы,
              покажет разбор и создаст карточки только после вашего подтверждения.
            </p>
          </div>
        </div>
        <UploadPanel
          canWrite={canWriteCards}
          onUploaded={created => {
            queryClient.setQueryData(procurementKeys.cardImport(created.id), created)
            navigate(`/procurement/requests/import/${created.id}`, { replace: true })
          }}
        />
        <RecentImports />
      </div>
    )
  }

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!run) return <EmptyState title="Импорт не найден" />

  const editable = isImportEditable(run) && canWriteCards
  const running = isImportRunning(run)
  const operationError = remap.error || confirm.error || normalize.error || cancel.error

  return (
    <div className="pr-stack">
      <RouterLinkButton to="/procurement/requests/import" variant="ghost" size="sm">
        <ArrowLeft size={15} />Новый импорт
      </RouterLinkButton>

      <div className="pr-section-heading">
        <div>
          <h2>{run.filename}</h2>
          <p>
            <CopyableId value={run.id} />
            {run.sheetName ? ` · лист «${run.sheetName}»` : ''}
            {run.headerRowNumber ? ` · заголовок в строке ${run.headerRowNumber}` : ''}
          </p>
        </div>
        <div className="pr-inline-actions">
          <StatusBadge status={run.status} label={importStatusLabels[run.status]} />
          {running && (
            <Button variant="outline" isDisabled={cancel.isPending} onPress={() => cancel.mutate()}>
              Остановить
            </Button>
          )}
          <Button variant="ghost" onPress={() => query.refetch()} aria-label="Обновить">
            <Refresh size={15} />
          </Button>
        </div>
      </div>

      <ImportProgress run={run} />

      {run.errors.map((error, index) => (
        <Alert key={index}>
          <CircleAlert />
          <AlertTitle>Импорт сообщает об ошибке</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ))}

      {operationError && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Операция не выполнена</AlertTitle>
          <AlertDescription>{mutationMessage(operationError)}</AlertDescription>
        </Alert>
      )}

      {run.status === 'FAILED' && (
        <div className="pr-inline-actions">
          <RouterLinkButton to="/procurement/requests/import">
            <Plus size={15} />Загрузить другой файл
          </RouterLinkButton>
        </div>
      )}

      {run.summary.totalRows > 0 && <SummaryChips summary={run.summary} />}

      {editable && (
        <Card>
          <CardHeader><CardTitle>Сопоставление столбцов</CardTitle></CardHeader>
          <CardContent>
            <ImportMappingEditor
              run={run}
              disabled={remap.isPending}
              onChange={(index, field) => remap.mutate({ index, field })}
            />
          </CardContent>
        </Card>
      )}

      <NormalizationPanel
        run={run}
        canWrite={canWriteCards}
        isStarting={normalize.isPending}
        isCancelling={cancel.isPending}
        onStart={() => normalize.mutate()}
        onCancel={() => cancel.mutate()}
        onFilterOutcome={outcome => setStatusFilter(`NORMALIZATION:${outcome}`)}
      />

      {run.summary.created > 0 && (
        <div className="pr-inline-actions">
          <RouterLinkButton to="/procurement/requests?status=DRAFT">
            Открыть черновики карточек
          </RouterLinkButton>
        </div>
      )}

      <ImportRowsTable
        run={run}
        rows={rows}
        editable={editable}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
        normalizationFilters={normalizationFilters}
        normalizationCounts={normalizationCounts}
        normalizationRunning={normalizationRunning}
        selectable={selectable}
        deselected={deselected}
        onDeselectedChange={setDeselected}
        selectedCount={selectedCount}
        visibleRows={visibleRows}
        visibleRowStep={VISIBLE_ROW_STEP}
        onShowMore={() => setVisibleRows(count => count + VISIBLE_ROW_STEP)}
      />

      {editable && (
        <ImportConfirmPanel
          duplicatePolicy={duplicatePolicy}
          onDuplicatePolicyChange={setDuplicatePolicy}
          selectedCount={selectedCount}
          draftCount={selectable.filter(row =>
            !deselected.has(row.rowNumber) && row.incompleteFields.length,
          ).length}
          isPending={confirm.isPending}
          onConfirm={() => confirm.mutate()}
        />
      )}
    </div>
  )
}
