import React, { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { importFilePayload, validateImportFile } from '../api/imports'
import { parseSubstances, substancesToCsv, typedListFilename, utf8ToBase64 } from '../lib/purchases'
import { Button } from '@/components/ui/button'
import { plural } from './SourcingSettings'
import { FileCheck, Search } from './icons'

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось начать закупку.'

/** One field and one button, like a search box.
 *
 * A typed substance and a dropped file take the same road — the import —
 * so one substance and a list of two hundred are searched the same way.
 */
export function PurchaseStart({ canWrite }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef(null)
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState(null)
  const items = parseSubstances(text)

  const start = useMutation({
    mutationFn: ({ payload }) => procurementApi.createCardImport(payload),
    onSuccess: (created, { source }) => {
      queryClient.setQueryData(procurementKeys.cardImport(created.id), created)
      navigate(`/procurement/requests/import/${created.id}`, { state: { quickStart: source } })
    },
  })

  const submitText = () => {
    if (!items.length || start.isPending) return
    start.mutate({ source: 'text', payload: { filename: typedListFilename(items), data_base64: utf8ToBase64(substancesToCsv(items)) } })
  }
  const submitFile = async file => {
    const problem = validateImportFile(file)
    setFileError(problem)
    if (problem || start.isPending) return
    start.mutate({ source: 'file', payload: await importFilePayload(file) })
  }

  if (!canWrite) return null
  const lines = Math.min(8, Math.max(1, text.split('\n').length))
  return <section className="pr-start" aria-label="Новая закупка">
    <h2>Какие вещества ищем?</h2>
    <form
      className="pr-start__box"
      onSubmit={event => { event.preventDefault(); submitText() }}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) submitFile(file) }}
    >
      <textarea
        aria-label="CAS или название вещества"
        rows={lines}
        value={text}
        disabled={start.isPending}
        placeholder="CAS или название, например 108-88-3 Toluene"
        onChange={event => { setText(event.target.value); start.reset() }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitText() }
        }}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv,.tsv,.md,.txt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp"
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) submitFile(file) }}
      />
      <Button type="button" variant="ghost" isDisabled={start.isPending} onPress={() => fileInput.current?.click()}>
        <FileCheck size={16} />Файл
      </Button>
      <Button type="submit" isDisabled={!items.length || start.isPending}>
        <Search size={16} className={start.isPending ? 'pr-spin' : undefined} />
        {start.isPending ? 'Разбираем…' : 'Найти поставщиков'}
      </Button>
    </form>
    <p className="pr-start__hint">
      {items.length > 1 ? `В списке ${items.length} ${plural(items.length, 'вещество', 'вещества', 'веществ')}. ` : ''}
      Список — по строке на вещество: можно вставить столбец из Excel или перетащить файл. Дальше — проверка названий и запуск поиска.{' '}
      <Link to="/procurement/requests">Выбрать из реестра карточек</Link>
    </p>
    {(fileError || start.isError) && <p className="pr-form-error" role="alert">{fileError || mutationMessage(start.error)}</p>}
  </section>
}
