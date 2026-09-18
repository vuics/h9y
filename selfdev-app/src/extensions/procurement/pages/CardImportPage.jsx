import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

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
import { CampaignLaunchPanel } from '../components/CampaignLaunchPanel'
import { plural } from '../components/SourcingSettings'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CircleAlert, Plus, Refresh, Search } from '../components/icons'

// With a 300-row file, rendering every row at once is neither fast nor readable.
const VISIBLE_ROW_STEP = 50

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось выполнить операцию.'

export default function CardImportPage() {
  const { importId } = useParams()
  const navigate = useNavigate()
  // Set by the purchases home: 'text' for substances typed into its field,
  // 'file' for a file dropped on it. Either way the purchaser already said
  // what to search for, so the page moves on to the launch by itself.
  const quickStart = useLocation().state?.quickStart
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleRows, setVisibleRows] = useState(VISIBLE_ROW_STEP)
  const [deselected, setDeselected] = useState(() => new Set())
  const [duplicatePolicy, setDuplicatePolicy] = useState('SKIP')
  const [launching, setLaunching] = useState(false)
  const launchPanel = useRef(null)

  const query = useQuery({
    queryKey: procurementKeys.cardImport(importId),
    queryFn: ({ signal }) => procurementApi.cardImport(importId, signal),
    enabled: Boolean(importId),
    refetchInterval: data => (isImportRunning(data) ? 1500 : false),
  })
  const run = query.data

  // Campaigns already started from this file. Without them the page looked
  // exactly as it did before the launch, and the button asked to be pressed
  // again — which is how one list became eleven identical campaigns.
  const campaigns = useQuery({
    queryKey: procurementKeys.campaigns(),
    queryFn: ({ signal }) => procurementApi.campaigns(signal),
    enabled: Boolean(importId),
  })
  const launchedFromHere = useMemo(
    () => (campaigns.data?.items || []).filter(item => item.importId && item.importId === importId),
    [campaigns.data, importId],
  )

  // The panel opens below the fold on a long file; bring it into view so the
  // press visibly did something.
  useEffect(() => {
    if (launching) launchPanel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [launching])

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
  // The cards this file actually produced, in file order, so a campaign
  // launched from here covers exactly what was just imported — not every draft
  // in the register, and not a row that failed to become a card.
  const createdCardIds = useMemo(
    () => (run?.rows || []).map(row => row.createdCardId).filter(id => id != null),
    [run?.rows],
  )
  // A typed substance that is already in the register is searched on its
  // existing card: typing "Toluene" again means "find Toluene", not "make a
  // second Toluene card" — and not "nothing to do".
  const launchCardIds = useMemo(() => {
    if (!quickStart) return createdCardIds
    const existing = (run?.rows || [])
      .filter(row => row.status === 'DUPLICATE' && row.duplicateCardId != null)
      .map(row => row.duplicateCardId)
    return [...new Set([...createdCardIds, ...existing])]
  }, [quickStart, createdCardIds, run?.rows])

  // Typed substances need no column mapping or row selection: the list is
  // what the purchaser just wrote. Confirmed once, with duplicates skipped.
  const autoConfirmed = useRef(false)
  useEffect(() => {
    if (quickStart !== 'text' || autoConfirmed.current || !canWriteCards) return
    if (run?.status !== 'AWAITING_CONFIRMATION' || !selectable.length) return
    autoConfirmed.current = true
    confirm.mutate()
  }, [quickStart, run?.status, selectable.length, canWriteCards, confirm])

  const autoLaunch = useRef(false)
  useEffect(() => {
    if (!quickStart || autoLaunch.current || !canWriteCards || campaigns.isLoading) return
    if (isImportRunning(run) || confirm.isPending || !launchCardIds.length || launchedFromHere.length) return
    if (run?.status === 'AWAITING_CONFIRMATION' && selectable.length) return
    autoLaunch.current = true
    setLaunching(true)
  }, [quickStart, canWriteCards, campaigns.isLoading, run, confirm.isPending, launchCardIds.length, launchedFromHere.length, selectable.length])

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

      {launchedFromHere.length > 0 && (
        <Alert className="pr-import-launched">
          <Search />
          <AlertTitle>
            {launchedFromHere.length === 1
              ? 'Поиск по этому файлу уже запущен'
              : `Поиск по этому файлу уже запускали ${launchedFromHere.length} ${plural(launchedFromHere.length, 'раз', 'раза', 'раз')}`}
          </AlertTitle>
          <AlertDescription>
            <ul className="pr-import-launched__list">
              {launchedFromHere.slice(0, 5).map(item => (
                <li key={item.campaignId}>
                  <Link to={`/procurement/campaigns/${item.campaignId}`}>
                    {item.title || item.campaignId}
                  </Link>
                  <CampaignStatusBadge status={item.status} />
                  <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</span>
                </li>
              ))}
            </ul>
            {launchedFromHere.length > 5 && <Link to="/procurement/campaigns">Все кампании</Link>}
          </AlertDescription>
        </Alert>
      )}

      {launchCardIds.length > 0 && (
        <div className="pr-inline-actions">
          {launchedFromHere.length > 0 && (
            <RouterLinkButton to={`/procurement/campaigns/${launchedFromHere[0].campaignId}`}>
              Открыть кампанию
            </RouterLinkButton>
          )}
          {canWriteCards && !launching && (
            <Button
              variant={launchedFromHere.length ? 'outline' : undefined}
              isDisabled={campaigns.isLoading}
              onPress={() => setLaunching(true)}
            >
              <Search size={15} />
              {launchedFromHere.length
                ? 'Запустить ещё одну кампанию'
                : `Запустить поиск по ${launchCardIds.length} ${plural(launchCardIds.length, 'веществу', 'веществам', 'веществам')}`}
            </Button>
          )}
          <RouterLinkButton to="/procurement/requests?status=DRAFT" variant="outline">
            Открыть черновики карточек
          </RouterLinkButton>
        </div>
      )}

      {/* Offered here rather than only in the register: the file has just
          become two hundred cards, and asking the operator to go and find them
          again to do the one thing they uploaded the file for is the step the
          batch launch exists to remove. */}
      {launching && launchCardIds.length > 0 && (
        <div ref={launchPanel}><CampaignLaunchPanel
          compact={Boolean(quickStart)}
          cardIds={launchCardIds}
          importId={run.id}
          canEdit={canWriteCards}
          onCancel={() => setLaunching(false)}
        /></div>
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
