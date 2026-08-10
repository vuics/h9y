import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import {
  importFieldLabels,
  importFilePayload,
  importRowStatusLabels,
  importStatusLabels,
  normalizationOutcomeLabels,
  isImportEditable,
  isImportRunning,
  selectableRows,
  validateImportFile,
} from '../api/imports'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { ImportProgress } from '../components/ImportProgress'
import { ImportMappingEditor } from '../components/ImportMappingEditor'
import { NormalizationPanel } from '../components/NormalizationPanel'
import { SelectField } from '../components/SelectField'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, ArrowLeft, Check, CircleAlert, FileCheck, Plus, Refresh } from '../components/icons'

// With a 300-row file, rendering every row at once is neither fast nor readable.
const VISIBLE_ROW_STEP = 50

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось выполнить операцию.'

function SummaryChips({ summary }) {
  const chips = [
    ['Всего строк', summary.totalRows, 'neutral'],
    ['Готовы полностью', summary.ready, 'good'],
    ['Черновики', summary.draft, 'warn'],
    ['Дубли', summary.duplicate, 'warn'],
    ['Не опознаны', summary.unidentified, 'bad'],
    ['Пустые', summary.empty, 'muted'],
    ['Исправлено значений', summary.repairedRows, 'neutral'],
  ].filter(([, value]) => value > 0 || value === summary.totalRows)
  return (
    <ul className="pr-import-chips">
      {chips.map(([label, value, tone]) => (
        <li key={label} className={`is-${tone}`}><b>{value}</b><span>{label}</span></li>
      ))}
    </ul>
  )
}

function RowIssues({ row }) {
  if (!row.repairs.length && !row.issues.length) return null
  return (
    <ul className="pr-import-row-notes">
      {row.repairs.map((note, index) => (
        <li key={`r${index}`} className="is-repair"><Check size={12} />{note}</li>
      ))}
      {row.issues.map((note, index) => (
        <li key={`i${index}`} className="is-issue"><AlertTriangle size={12} />{note}</li>
      ))}
    </ul>
  )
}

function UploadPanel({ onUploaded, canWrite }) {
  const [file, setFile] = useState(null)
  const validation = file ? validateImportFile(file) : null
  const upload = useMutation({
    mutationFn: async () => procurementApi.createCardImport(await importFilePayload(file)),
    onSuccess: onUploaded,
  })

  if (!canWrite) {
    return (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Недостаточно прав</AlertTitle>
        <AlertDescription>Для массового импорта требуется CARD_WRITE.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Файл со списком веществ</CardTitle></CardHeader>
      <CardContent>
        <form
          className="pr-card-form"
          onSubmit={event => { event.preventDefault(); if (!validation && file) upload.mutate() }}
        >
          <label className="pr-form-field pr-form-field--wide">
            <span>Excel, CSV, Word, PDF или изображение таблицы</span>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.md,.txt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={event => { setFile(event.target.files?.[0] || null); upload.reset() }}
            />
            <small>
              До 15 МБ. Структуру таблицы система определит сама — заголовки могут быть
              на русском или английском, лишние столбцы допустимы.
            </small>
          </label>

          {file && (
            <div className="pr-upload-list pr-form-field--wide">
              <div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024).toFixed(1)} КБ</span>
              </div>
            </div>
          )}
          {validation && <p className="pr-form-error pr-form-field--wide">{validation}</p>}
          {upload.isError && (
            <Alert className="pr-form-field--wide">
              <CircleAlert />
              <AlertTitle>Файл не принят</AlertTitle>
              <AlertDescription>{mutationMessage(upload.error)}</AlertDescription>
            </Alert>
          )}

          <div className="pr-form-actions">
            <Button type="submit" isDisabled={!file || Boolean(validation) || upload.isPending}>
              <FileCheck />
              {upload.isPending ? 'Загружаем и распознаём…' : 'Разобрать файл'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RecentImports() {
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

      <Card>
        <CardHeader>
          <CardTitle>Строки файла</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="pr-import-toolbar">
            <Select
              selectedKey={statusFilter}
              onSelectionChange={setStatusFilter}
              aria-label="Фильтр по состоянию строки"
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem id="all">Все строки ({run.rows.length})</SelectItem>
                {Object.entries(statusCounts).map(([status, count]) => (
                  <SelectItem key={status} id={status}>
                    {importRowStatusLabels[status] || status} ({count})
                  </SelectItem>
                ))}
                {normalizationFilters.map(outcome => (
                  <SelectItem key={outcome} id={`NORMALIZATION:${outcome}`}>
                    PubChem: {normalizationOutcomeLabels[outcome] || outcome}{' '}
                    ({normalizationCounts[outcome]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editable && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setDeselected(new Set())}
                  isDisabled={deselected.size === 0}
                >
                  Выбрать все подходящие
                </Button>
                <span className="pr-note">
                  Будет создано карточек: <b>{selectedCount}</b>
                </span>
              </>
            )}
          </div>

          <div className="pr-import-rows">
            <table>
              <thead>
                <tr>
                  {editable && <th aria-label="Импортировать" />}
                  <th>Стр.</th>
                  <th>Состояние</th>
                  {(run.availableFields || []).map(field => (
                    <th key={field}>{importFieldLabels[field] || field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, visibleRows).map(row => {
                  const included = selectable.some(item => item.rowNumber === row.rowNumber) &&
                    !deselected.has(row.rowNumber)
                  const canToggle = editable &&
                    selectable.some(item => item.rowNumber === row.rowNumber)
                  return (
                    <tr key={row.rowNumber} className={included ? '' : 'is-excluded'}>
                      {editable && (
                        <td>
                          <input
                            type="checkbox"
                            checked={included}
                            disabled={!canToggle}
                            aria-label={`Импортировать строку ${row.rowNumber}`}
                            onChange={event => setDeselected(previous => {
                              const next = new Set(previous)
                              if (event.target.checked) next.delete(row.rowNumber)
                              else next.add(row.rowNumber)
                              return next
                            })}
                          />
                        </td>
                      )}
                      <td>{row.rowNumber}</td>
                      <td>
                        <StatusBadge
                          status={row.status}
                          label={importRowStatusLabels[row.status]}
                          compact
                        />
                        {row.createdCardId && (
                          <Link to={`/procurement/requests/${row.createdCardId}`}>
                            #{row.createdCardId}
                          </Link>
                        )}
                        {row.duplicateCardId && (
                          <Link to={`/procurement/requests/${row.duplicateCardId}`}>
                            дубль #{row.duplicateCardId}
                          </Link>
                        )}
                        {row.normalizationStatus
                          ? <StatusBadge status={row.normalizationStatus} compact />
                          : row.createdCardId && normalizationRunning
                            ? <span className="pr-import-checking">
                                <Refresh size={12} className="pr-spin" />
                                сверяем…
                              </span>
                            : null}
                        <RowIssues row={row} />
                      </td>
                      {(run.availableFields || []).map(field => (
                        <td key={field}>
                          {row.cardFields?.[field] || (
                            row.incompleteFields.includes(field)
                              ? <em className="pr-import-missing">будет заполнено вручную</em>
                              : '—'
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {rows.length > visibleRows && (
            <Button
              variant="outline"
              onPress={() => setVisibleRows(count => count + VISIBLE_ROW_STEP)}
            >
              Показать ещё {Math.min(VISIBLE_ROW_STEP, rows.length - visibleRows)} из{' '}
              {rows.length - visibleRows}
            </Button>
          )}
        </CardContent>
      </Card>

      {editable && (
        <Card>
          <CardHeader><CardTitle>Создание карточек</CardTitle></CardHeader>
          <CardContent>
            <div className="pr-card-form">
              <SelectField
                label="Если вещество уже есть в карточке"
                selectedKey={duplicatePolicy}
                onSelectionChange={setDuplicatePolicy}
                hint={(
                  <small>
                    Совпадение определяется по каноническому CAS-номеру, а при его
                    отсутствии — по нормализованному наименованию.
                  </small>
                )}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem id="SKIP">Пропустить существующие</SelectItem>
                  <SelectItem id="CREATE">Создать карточку всё равно</SelectItem>
                </SelectContent>
              </SelectField>

              <Alert className="pr-form-field--wide">
                <AlertTriangle />
                <AlertTitle>Это необратимый шаг</AlertTitle>
                <AlertDescription>
                  Будет создано карточек: {selectedCount}, из них черновиков:{' '}
                  {selectable.filter(row =>
                    !deselected.has(row.rowNumber) && row.incompleteFields.length,
                  ).length}. Черновик нельзя отправить поставщику: RFQ станет доступен
                  после заполнения обязательных полей.
                </AlertDescription>
              </Alert>

              <div className="pr-form-actions">
                <Button
                  isDisabled={confirm.isPending || selectedCount === 0}
                  onPress={() => confirm.mutate()}
                >
                  <FileCheck />
                  {confirm.isPending
                    ? 'Создаём карточки…'
                    : `Создать ${selectedCount} карточек`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
