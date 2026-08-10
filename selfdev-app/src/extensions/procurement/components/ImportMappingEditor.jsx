import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { importFieldLabels, importMappingSourceLabels } from '../api/imports'

const UNMAPPED = '__unmapped__'

/**
 * Review and correct which source column feeds which card field.
 *
 * A field already taken by another column is disabled rather than hidden, so it
 * is obvious why it cannot be chosen twice.
 */
export function ImportMappingEditor({ run, onChange, disabled }) {
  const columns = run?.columns || []
  const available = run?.availableFields || Object.keys(importFieldLabels)
  const takenBy = new Map(
    columns.filter(column => column.field).map(column => [column.field, column.index]),
  )

  return (
    <div className="pr-import-mapping">
      {columns.map(column => {
        const value = column.field || UNMAPPED
        return (
          <div key={column.index} className="pr-import-mapping__row">
            <div className="pr-import-mapping__source">
              <strong>{column.header || `Столбец ${column.index + 1}`}</strong>
              <small>
                {column.sampleValues?.length
                  ? `например: ${column.sampleValues.join(' · ')}`
                  : 'в файле нет значений в этом столбце'}
              </small>
            </div>

            <Select
              selectedKey={value}
              onSelectionChange={key => onChange(column.index, key === UNMAPPED ? null : key)}
              isDisabled={disabled}
              aria-label={`Поле карточки для столбца ${column.header || column.index + 1}`}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem id={UNMAPPED}>Не использовать как поле</SelectItem>
                {available.map(field => (
                  <SelectItem
                    key={field}
                    id={field}
                    isDisabled={takenBy.has(field) && takenBy.get(field) !== column.index}
                  >
                    {importFieldLabels[field] || field}
                    {takenBy.has(field) && takenBy.get(field) !== column.index ? ' — занято' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" title={column.rationale || ''}>
              {importMappingSourceLabels[column.source] || column.source}
            </Badge>
          </div>
        )
      })}

      <p className="pr-note">
        Столбцы без поля карточки не теряются: их значения сохраняются в карточке
        целиком и попадают в комментарий специалиста.
      </p>
    </div>
  )
}
