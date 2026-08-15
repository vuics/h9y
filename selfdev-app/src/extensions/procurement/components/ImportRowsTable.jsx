import React from 'react'
import { Link } from 'react-router-dom'

import {
  importFieldLabels,
  importRowStatusLabels,
  normalizationOutcomeLabels,
} from '../api/imports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowIssues } from './ImportSummary'
import { StatusBadge } from './StatusBadge'
import { Refresh } from './icons'

/** The recognised file, row by row, with the import selection for each one.
 *
 * Rows are windowed rather than all rendered: a 300-row file is normal, and the
 * specialist reads the first screenful before deciding anything.
 */
export function ImportRowsTable({
  run,
  rows,
  editable,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  normalizationFilters,
  normalizationCounts,
  normalizationRunning,
  selectable,
  deselected,
  onDeselectedChange,
  selectedCount,
  visibleRows,
  onShowMore,
  visibleRowStep,
}) {
  const fields = run.availableFields || []
  const isSelectable = rowNumber => selectable.some(item => item.rowNumber === rowNumber)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Строки файла</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="pr-import-toolbar">
          <Select
            selectedKey={statusFilter}
            onSelectionChange={onStatusFilterChange}
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
                onPress={() => onDeselectedChange(new Set())}
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
                {fields.map(field => (
                  <th key={field}>{importFieldLabels[field] || field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visibleRows).map(row => {
                const included = isSelectable(row.rowNumber) && !deselected.has(row.rowNumber)
                const canToggle = editable && isSelectable(row.rowNumber)
                return (
                  <tr key={row.rowNumber} className={included ? '' : 'is-excluded'}>
                    {editable && (
                      <td>
                        <input
                          type="checkbox"
                          checked={included}
                          disabled={!canToggle}
                          aria-label={`Импортировать строку ${row.rowNumber}`}
                          onChange={event => {
                            const next = new Set(deselected)
                            if (event.target.checked) next.delete(row.rowNumber)
                            else next.add(row.rowNumber)
                            onDeselectedChange(next)
                          }}
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
                    {fields.map(field => (
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
          <Button variant="outline" onPress={onShowMore}>
            Показать ещё {Math.min(visibleRowStep, rows.length - visibleRows)} из{' '}
            {rows.length - visibleRows}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
