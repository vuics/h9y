import React, { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { importFilePayload, validateImportFile } from '../api/imports'
import { classifyQuery, parseSubstances, substancesToCsv, typedListFilename, utf8ToBase64 } from '../lib/purchases'
import { Button } from '@/components/ui/button'
import { CampaignLaunchPanel } from './CampaignLaunchPanel'
import { plural } from './SourcingSettings'
import { FileCheck, Plus, Search } from './icons'

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось начать закупку.'

const SEARCH_DELAY_MS = 250

/** One field, like a search box: it looks in the register before it creates.
 *
 * A card number, a CAS or a name is looked up first and the matching cards
 * are offered with «Найти поставщиков» — a purchase of that one card, run the
 * same way as a list. Only what the register does not have becomes a new card,
 * and never from a bare number. A pasted list or a dropped file goes through
 * the import, which checks every line for duplicates itself.
 */
export function PurchaseStart({ canWrite }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef(null)
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState(null)
  const [chosen, setChosen] = useState(null)
  const query = classifyQuery(text)
  const typed = parseSubstances(text)

  const [search, setSearch] = useState('')
  useEffect(() => {
    const single = ['number', 'cas', 'name'].includes(query.kind)
    const term = !single ? '' : query.kind === 'name' ? (typed[0]?.cas || typed[0]?.name || '') : query.value
    const timer = setTimeout(() => setSearch(term.length >= 2 || query.kind === 'number' ? term : ''), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const filters = { search, page: 1, pageSize: 6 }
  const found = useQuery({
    queryKey: procurementKeys.cards(filters),
    queryFn: ({ signal }) => procurementApi.cards(filters, signal),
    enabled: Boolean(search),
    keepPreviousData: true,
  })
  const exact = query.kind === 'number' ? String(query.value) : null
  const cards = [...(found.data?.items || [])]
    .sort((left, right) => (String(right.id) === exact) - (String(left.id) === exact))
  const searched = Boolean(search) && !found.isFetching && found.isSuccess
  const canCreate = query.kind === 'name' || query.kind === 'cas'

  const start = useMutation({
    mutationFn: ({ payload }) => procurementApi.createCardImport(payload),
    onSuccess: (created, { source }) => {
      queryClient.setQueryData(procurementKeys.cardImport(created.id), created)
      navigate(`/procurement/requests/import/${created.id}`, { state: { quickStart: source } })
    },
  })

  const createFromText = () => {
    if (!typed.length || start.isPending) return
    start.mutate({ source: 'text', payload: { filename: typedListFilename(typed), data_base64: utf8ToBase64(substancesToCsv(typed)) } })
  }
  const submitFile = async file => {
    const problem = validateImportFile(file)
    setFileError(problem)
    if (problem || start.isPending) return
    start.mutate({ source: 'file', payload: await importFilePayload(file) })
  }
  // Enter does the one obvious thing: a list is imported; a single match is
  // chosen; nothing found makes the card. Otherwise the choice stays on screen.
  const submit = () => {
    if (query.kind === 'list') return createFromText()
    if (!searched) return
    if (cards.length === 1) return setChosen(cards[0])
    if (!cards.length && canCreate) createFromText()
  }

  if (!canWrite) return null
  const lines = Math.min(8, Math.max(1, text.split('\n').length))
  const showResults = query.kind !== 'list' && query.kind !== 'empty' && Boolean(search)
  return <section className="pr-start" aria-label="Новая закупка">
    <h2>Какие вещества ищем?</h2>
    <form
      className="pr-start__box"
      onSubmit={event => { event.preventDefault(); submit() }}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) submitFile(file) }}
    >
      <textarea
        aria-label="Номер карточки, CAS или название вещества"
        rows={lines}
        value={text}
        disabled={start.isPending}
        placeholder="Номер карточки, CAS или название, например 108-88-3 Toluene"
        onChange={event => { setText(event.target.value); setChosen(null); start.reset() }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
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
      <Button type="submit" isDisabled={query.kind === 'empty' || start.isPending || (query.kind !== 'list' && !searched)}>
        <Search size={16} className={start.isPending || found.isFetching ? 'pr-spin' : undefined} />
        {start.isPending ? 'Разбираем…' : query.kind === 'list' ? `Найти поставщиков: ${typed.length} ${plural(typed.length, 'вещество', 'вещества', 'веществ')}` : 'Найти'}
      </Button>
    </form>

    {showResults && <div className="pr-start__results" aria-live="polite">
      {!searched && <p className="pr-note">Ищем в реестре…</p>}
      {searched && cards.map(card => <div key={card.id} className={chosen?.id === card.id ? 'pr-start__card is-chosen' : 'pr-start__card'}>
        <div>
          <strong>{card.substanceName || card.title}</strong>
          <span>#{card.id}{card.casNumber ? ` · CAS ${card.casNumber}` : ''}{card.isDraft ? ' · черновик' : ''}</span>
        </div>
        <Link to={`/procurement/requests/${card.id}`}>Открыть карточку</Link>
        <Button size="sm" variant={chosen?.id === card.id ? 'outline' : undefined} onPress={() => setChosen(value => (value?.id === card.id ? null : card))}>
          {chosen?.id === card.id ? 'Скрыть запуск' : 'Найти поставщиков'}
        </Button>
      </div>)}
      {searched && !cards.length && <p className="pr-note">
        {query.kind === 'number' ? `Карточки #${query.value} нет в реестре.` : 'В реестре такого вещества нет.'}
      </p>}
      {searched && canCreate && <button type="button" className="pr-start__create" disabled={start.isPending} onClick={createFromText}>
        <Plus size={15} />Новая карточка «{typed[0]?.name || typed[0]?.cas}»{typed[0]?.name && typed[0]?.cas ? ` · CAS ${typed[0].cas}` : ''} и поиск поставщиков
      </button>}
    </div>}

    {chosen && <div className="pr-start__launch">
      <CampaignLaunchPanel compact cardIds={[chosen.id]} substanceName={chosen.substanceName || chosen.title} cas={chosen.casNumber} canEdit={canWrite} onCancel={() => setChosen(null)} />
    </div>}

    <p className="pr-start__hint">
      Список — по строке на вещество: можно вставить столбец из Excel или перетащить файл.{' '}
      <Link to="/procurement/requests">Реестр карточек</Link>
    </p>
    {(fileError || start.isError) && <p className="pr-form-error" role="alert">{fileError || mutationMessage(start.error)}</p>}
  </section>
}
