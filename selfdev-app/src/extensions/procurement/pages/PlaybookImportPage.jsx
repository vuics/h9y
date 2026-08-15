import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { StatusBadge } from '../components/StatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { KIND_SINGULAR, TOPIC_LABELS } from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Check, CircleAlert, FileCheck } from '../components/icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')
const mutationMessage = error => error?.response?.data?.message || error?.message

async function toBase64(file) {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK))
  }
  return btoa(binary)
}

function ProposalRow({ proposal, selected, onToggle, decided }) {
  return (
    <li className={`pr-proposal${selected ? ' pr-proposal--selected' : ''}`}>
      <div className="pr-proposal__head">
        {!decided && (
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Принять «${proposal.title}»`}
            onChange={() => onToggle(proposal.proposalId)}
          />
        )}
        <strong>{proposal.title}</strong>
        <Badge variant="outline">{KIND_SINGULAR[proposal.kind] || proposal.kind}</Badge>
        {proposal.topic && <Badge>{TOPIC_LABELS[proposal.topic] || proposal.topic}</Badge>}
        {proposal.language !== 'any' && <Badge variant="outline">{proposal.language.toUpperCase()}</Badge>}
        {decided && <StatusBadge status={proposal.state === 'CREATED' ? 'CREATED' : 'SKIPPED'} compact />}
      </div>
      <p className="pr-proposal__body">{proposal.body}</p>
      <details className="pr-diff">
        <summary>Цитата из документа</summary>
        <pre className="pr-message-text">{proposal.evidenceQuote}</pre>
      </details>
      {proposal.createdItemId && (
        <Link to={`/procurement/communication/playbook/${proposal.createdItemId}`}>
          Открыть созданное правило
        </Link>
      )}
    </li>
  )
}

export default function PlaybookImportPage() {
  const { importId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWritePlaybook } = useProcurementPermissions()
  const [selected, setSelected] = useState(new Set())

  const run = useQuery({
    queryKey: procurementKeys.playbookImport(importId),
    queryFn: ({ signal }) => procurementApi.playbookImport(importId, signal),
    enabled: Boolean(importId),
    // Recognition and proposal extraction happen behind the upload response.
    refetchInterval: data => (data?.status === 'ANALYZING' ? 3000 : false),
  })

  const upload = useMutation({
    mutationFn: async file =>
      procurementApi.startPlaybookImport(file.name, await toBase64(file)),
    onSuccess: created => navigate(`/procurement/communication/imports/${created.importId}`),
  })
  const confirm = useMutation({
    mutationFn: () => procurementApi.confirmPlaybookImport(importId, [...selected]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.all }),
  })
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelPlaybookImport(importId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.all }),
  })

  if (!canWritePlaybook) {
    return (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Недостаточно прав</AlertTitle>
        <AlertDescription>Для импорта документов нужно право PLAYBOOK_WRITE.</AlertDescription>
      </Alert>
    )
  }

  if (!importId) {
    return (
      <DetailLayout
        backTo="/procurement/communication"
        backLabel="Библиотека коммуникации"
        eyebrow="Коммуникация"
        title="Импорт документов заказчика"
      >
        <Card>
          <CardHeader>
            <CardTitle>Загрузить документ</CardTitle>
            <p className="pr-muted">
              Шаблон RFQ, коммерческое письмо или свод типовых ответов — Word, PDF, Excel,
              изображение таблицы. Файл распознаётся тем же стеком, что и вложения поставщиков.
            </p>
            <p className="pr-muted">
              Документ <strong>ничего не добавляет в библиотеку сам по себе</strong>. Он
              превращается в список предложений, каждое со своей цитатой из документа, а что из
              этого станет правилом — решаете вы на следующем шаге.
            </p>
          </CardHeader>
          <CardContent>
            {upload.isError && (
              <Alert>
                <CircleAlert />
                <AlertTitle>Файл не принят</AlertTitle>
                <AlertDescription>{mutationMessage(upload.error)}</AlertDescription>
              </Alert>
            )}
            <label className="pr-form-field pr-form-field--wide">
              <span>Файл</span>
              <Input
                type="file"
                isDisabled={upload.isPending}
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) upload.mutate(file)
                }}
              />
              <small className="pr-muted">
                {upload.isPending ? 'Загружаем…' : 'Распознавание идёт в фоне, страница обновится сама.'}
              </small>
            </label>
          </CardContent>
        </Card>
      </DetailLayout>
    )
  }

  if (run.isLoading) return <LoadingState />
  if (run.isError) return <ErrorState error={run.error} onRetry={run.refetch} />
  const data = run.data
  if (!data) return <EmptyState title="Импорт не найден" />

  const decided = ['CONFIRMED', 'CANCELLED'].includes(data.status)
  const proposals = data.proposals || []
  const toggle = proposalId => setSelected(previous => {
    const next = new Set(previous)
    if (next.has(proposalId)) next.delete(proposalId)
    else next.add(proposalId)
    return next
  })

  return (
    <DetailLayout
      backTo="/procurement/communication"
      backLabel="Библиотека коммуникации"
      eyebrow={data.filename}
      title="Импорт документа"
      status={<StatusBadge status={data.status} />}
      meta={<><span>{formatDate(data.createdAt)}</span><span>символов распознано: {data.sourceChars}</span></>}
      warnings={
        <>
          {data.status === 'ANALYZING' && (
            <Alert>
              <FileCheck />
              <AlertTitle>Читаем документ</AlertTitle>
              <AlertDescription>
                Распознавание и разбор идут в фоне; страница обновится сама.
              </AlertDescription>
            </Alert>
          )}
          {data.error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Документ не разобран</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          )}
          {data.warnings?.length > 0 && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Замечания разбора</AlertTitle>
              <AlertDescription>{data.warnings.join(' ')}</AlertDescription>
            </Alert>
          )}
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Предложения из документа</CardTitle>
          <p className="pr-muted">
            У каждого предложения есть цитата, которая встречается в документе дословно —
            предложение без такой цитаты отброшено при разборе, а не показано вам на веру.
            Отметьте то, что хотите добавить в библиотеку.
          </p>
        </CardHeader>
        <CardContent>
          {confirm.isError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Не удалось создать правила</AlertTitle>
              <AlertDescription>{mutationMessage(confirm.error)}</AlertDescription>
            </Alert>
          )}
          {proposals.length === 0
            ? <EmptyState
              title="Предложений нет"
              description="Документ распознан, но пригодных для библиотеки правил в нём не нашлось."
            />
            : <ul className="pr-proposal-list">
              {proposals.map(proposal => (
                <ProposalRow
                  key={proposal.proposalId}
                  proposal={proposal}
                  selected={selected.has(proposal.proposalId)}
                  onToggle={toggle}
                  decided={decided}
                />
              ))}
            </ul>}

          {!decided && proposals.length > 0 && (
            <div className="pr-inline-actions">
              <Button
                isDisabled={selected.size === 0 || confirm.isPending}
                onPress={() => confirm.mutate()}
              >
                <Check size={15} />Добавить в библиотеку: {selected.size}
              </Button>
              <Button variant="outline" isDisabled={cancel.isPending} onPress={() => cancel.mutate()}>
                Отменить импорт
              </Button>
              <span className="pr-muted">Шаг необратимый: отмеченные предложения станут правилами.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.sourceExcerpt && (
        <details className="pr-diff">
          <summary>Распознанный текст документа (начало)</summary>
          <pre className="pr-message-text">{data.sourceExcerpt}</pre>
        </details>
      )}
    </DetailLayout>
  )
}
