/** Человек и агент на один кейс — график, по которому судят пилот.
 *
 * Its whole job is to be persuasive without overclaiming, so two things are
 * structural rather than cosmetic:
 *
 *   1. Each row is scaled to its own larger value. Hours and counts share no
 *      unit, and one axis across them would be a dual-axis chart in disguise.
 *   2. Every value says where it came from. The human column is always
 *      declared; the agent's hours are declared too, because a specialist still
 *      reviews candidates and approves RFQs, and only a person can say how long
 *      that took. Reporting the agent at zero hours would win the chart and be
 *      false.
 */

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert } from './icons'
import {
  BASELINE_FIELDS,
  baselineFormValues,
  benchmarkWidths,
  describeDelta,
} from '../lib/dashboard'

const SOURCE_LABELS = {
  MEASURED: 'измерено системой',
  DECLARED: 'введено вручную',
}

function formatValue(value, unit) {
  if (value == null) return '—'
  return `${String(value).replace('.', ',')}${unit ? ` ${unit}` : ''}`
}

function BenchmarkRow({ row }) {
  const widths = benchmarkWidths(row)
  const delta = describeDelta(row)
  return (
    <div className="pr-bench__row">
      <div className="pr-bench__label">
        {row.label}
        <small>{row.lowerIsBetter ? 'меньше — лучше' : 'больше — лучше'}</small>
      </div>
      <div className="pr-bench__bars">
        {[
          ['human', 'Человек', row.human, 'var(--chart-2)'],
          ['agent', 'Агент', row.agent, 'var(--chart-1)'],
        ].map(([side, sideLabel, cell, color]) => (
          <div className="pr-bench__bar" key={side}>
            <div
              className="pr-variant-bar__track"
              role="img"
              aria-label={`${sideLabel}, ${row.label}: ${formatValue(cell.value, row.unit)}`}
            >
              {cell.value != null && (
                <div
                  className="pr-variant-bar__fill"
                  data-declared={cell.source === 'DECLARED' ? 'true' : undefined}
                  style={{ width: `${widths[side]}%`, background: color }}
                />
              )}
            </div>
            <span className="pr-bench__value">
              <b>{formatValue(cell.value, row.unit)}</b>
              {cell.source && <span>{SOURCE_LABELS[cell.source]}</span>}
              {cell.total != null && <span>всего {cell.total}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="pr-bench__delta">
        {delta
          ? <Badge variant="outline" data-improved={delta.improved ? 'true' : 'false'}>
            {delta.arrow} {delta.text}
          </Badge>
          : <span className="pr-muted">нет эталона</span>}
      </div>
    </div>
  )
}

function BaselineForm({ rows, note, onDone }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => baselineFormValues(rows))
  const [comment, setComment] = useState(note || '')
  const save = useMutation({
    mutationFn: () => procurementApi.saveBenchmarkBaseline({ metrics: values, note: comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'analytics-benchmark'] })
      onDone()
    },
  })
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))

  return (
    <div className="pr-bench__form">
      <p className="pr-muted">
        Эти числа никто не измеряет за вас — их называет специалист. Оставьте поле
        пустым, если замера нет: строка покажет одну колонку, а не ноль.
      </p>
      {BASELINE_FIELDS.map(field => (
        <div className="pr-bench__field" key={field.key}>
          <label htmlFor={`human-${field.key}`}>
            {field.label}
            {field.unit && <small>{field.unit}</small>}
          </label>
          <Input
            id={`human-${field.key}`}
            inputMode="decimal"
            aria-label={`Человек: ${field.label}`}
            placeholder="человек"
            value={values[`HUMAN_${field.key}`] ?? ''}
            onChange={event => set(`HUMAN_${field.key}`, event.target.value)}
          />
          {field.agentDeclared
            ? <Input
              inputMode="decimal"
              aria-label={`Агент: ${field.label}`}
              placeholder="агент"
              value={values[`AGENT_${field.key}`] ?? ''}
              onChange={event => set(`AGENT_${field.key}`, event.target.value)}
            />
            : <span className="pr-bench__measured">измеряется системой</span>}
        </div>
      ))}
      <Textarea
        aria-label="Как получен замер"
        placeholder="Как получен замер: сколько кейсов, кто считал, за какой период"
        value={comment}
        onChange={event => setComment(event.target.value)}
      />
      {save.isError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Не удалось сохранить</AlertTitle>
          <AlertDescription>
            {save.error?.response?.data?.message || save.error?.message}
          </AlertDescription>
        </Alert>
      )}
      <div className="pr-inline-actions">
        <Button isDisabled={save.isPending} onPress={() => save.mutate()}>Сохранить эталон</Button>
        <Button variant="outline" isDisabled={save.isPending} onPress={onDone}>Отмена</Button>
      </div>
    </div>
  )
}

export function BenchmarkChart({ data, canEdit }) {
  const [editing, setEditing] = useState(false)
  const rows = data?.rows || []
  const baseline = data?.baseline || {}
  const recorded = baseline.recordedAt
    ? new Date(baseline.recordedAt).toLocaleDateString('ru-RU')
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Человек и агент, на один кейс</CardTitle>
        <p className="pr-muted">
          У каждой строки собственная шкала — часы и штуки несопоставимы, и одна
          общая ось выдумала бы сравнение, которого в данных нет.
        </p>
        {canEdit && !editing && (
          <div className="pr-inline-actions">
            <Button size="sm" variant="outline" onPress={() => setEditing(true)}>
              {baseline.present ? 'Изменить эталон' : 'Задать эталон'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <BaselineForm rows={rows} note={baseline.note} onDone={() => setEditing(false)} />
        ) : (
          <>
            {!baseline.present && (
              <Alert>
                <CircleAlert />
                <AlertTitle>Эталон человека не задан</AlertTitle>
                <AlertDescription>
                  Пока показана только колонка агента. Сравнивать не с чем, и
                  подставлять ноль вместо эталона значило бы нарисовать победу.
                </AlertDescription>
              </Alert>
            )}
            <div className="pr-bench">
              {rows.map(row => <BenchmarkRow key={row.key} row={row} />)}
            </div>
            <p className="pr-chart-note">
              Кейсов за период: <b>{data?.cases ?? 0}</b>
              {recorded && <> · эталон записал {baseline.recordedBy || 'специалист'}, {recorded}</>}
            </p>
            {baseline.note && <p className="pr-chart-note">{baseline.note}</p>}
            <p className="pr-chart-note">{data?.caseNote}</p>
            <p className="pr-chart-note">{data?.provenanceNote}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
