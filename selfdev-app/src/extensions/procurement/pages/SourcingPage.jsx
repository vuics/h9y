import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge, statusLabel } from '../components/StatusBadge'
import { businessRoleLabel, businessRoleSourceLabels } from '../components/BusinessRole'
import { ContactScanProgress, SourcingProgress } from '../components/SourcingProgress'
import { SourcingSourceTable } from '../components/SourcingSourceTable'
import { QueryPlanPanel } from '../components/QueryPlanPanel'
import { EnginePicker } from '../components/EnginePicker'
import { SelectField } from '../components/SelectField'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Building, Check, CircleAlert, ExternalLink, Refresh, Search } from '../components/icons'

const reviewOptions = [
  ['UNDER_REVIEW', 'Взять на проверку'],
  ['VERIFIED_MANUFACTURER', 'Подтвердить производителя'],
  ['VERIFIED_DISTRIBUTOR', 'Подтвердить дистрибьютора'],
  ['NEEDS_MORE_EVIDENCE', 'Запросить больше доказательств'],
  ['REJECTED', 'Отклонить кандидата'],
]

const evidenceLabels = {
  COMPANY_IDENTITY: 'Юридическая идентичность', COMPANY_LOCATION: 'Местонахождение', PRODUCT_MATCH: 'Соответствие продукту',
  MANUFACTURER_ROLE: 'Признак производства', DISTRIBUTOR_ROLE: 'Признак дистрибуции', PRODUCTION_CAPACITY: 'Производственные мощности',
  INVESTMENT_PROJECT: 'Инвестиционный проект', EXPORT_AUTHORIZATION: 'Экспортная лицензия', EXPORT_EXPERIENCE: 'Экспортный опыт',
  ENVIRONMENTAL_PERMIT: 'Экологическое разрешение', QUALITY_CERTIFICATION: 'Сертификат качества', REGULATORY_REGISTRATION: 'Регистрация у регулятора',
  CONTACT: 'Контакт', REFERENCE_STANDARDS_SCOPE: 'Аналитические стандарты, не сырьё',
  NEGATIVE_RISK: 'Негативный риск', PRODUCT_MISMATCH: 'Несоответствие продукта',
}

const formatDate = value => value ? new Date(value).toLocaleString('ru-RU') : '—'
const mutationMessage = error => error?.response?.data?.message || error?.message
const externalUrl = value => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

// Mirrors the backend: the chosen number is a budget shared out over the
// queries, then clamped, so the same choice means different things depending on
// how many queries a run uses. Stating the result stops "10" reading as a
// promise of ten sources when it produces about eighty.
const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const perQueryResults = (maxResults, queryCount) =>
  Math.max(2, Math.min(10, Math.ceil(maxResults / queryCount)))

function Score({ candidate }) {
  return <div className={`pr-sourcing-score pr-sourcing-score--${candidate.preliminaryStatus?.toLowerCase()}`} aria-label={`Оценка ${candidate.score} из 100`}><strong>{candidate.score}</strong><span>/100</span></div>
}

// Mirrors the deterministic rules in the backend's `qualify_candidate`. Kept
// visible because an unexplained number reads as an opinion, and the whole
// point of this screen is that the rating is arithmetic a specialist can check.
const scoringAdds = [
  ['+30', 'Продукт или CAS подтверждён на официальном сайте компании'],
  ['+10', '…или только сторонним источником'],
  ['+25', 'Роль производителя заявлена на официальном сайте компании'],
  ['+10', '…или подтверждена только сторонним источником'],
  ['+10…20', 'Лицензия, разрешение или регистрация в государственном либо регуляторном источнике (по 10 за категорию)'],
  ['+10', 'Опубликованы сведения о производственных мощностях'],
  ['+10', 'Ключевые сведения подтверждены минимум двумя независимыми доменами'],
  ['+5', 'Инвестиционный или производственный проект'],
  ['+5', 'Экспортный опыт'],
  ['+5', 'Сертификация системы или продукции'],
]

const scoringSubtracts = [
  ['−50', 'Источник указывает на несоответствие запрошенному продукту или CAS'],
  ['−35', 'Явный негативный регуляторный или репутационный сигнал'],
  ['−20', 'Источники содержат противоречивые сведения'],
  ['−20', 'У компании с таким названием указаны разные страны'],
  ['−20', 'С одним названием связаны несколько официальных доменов'],
  ['−20', 'Источник описывает поставщика аналитических стандартов и реактивов, а не сырья'],
  ['−15', 'Компания или источник указывает на роль дистрибьютора либо трейдера'],
]

const decisionLabels = {
  VERIFIED_MANUFACTURER: 'производитель',
  VERIFIED_DISTRIBUTOR: 'дистрибьютор',
  NEEDS_MORE_EVIDENCE: 'нужны доказательства',
  REJECTED: 'отклонён',
  UNDER_REVIEW: 'на проверке',
}

const shortDate = value => value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : null

// A verdict is recorded per substance, so the CAS it was made on travels with
// it: the same company can be the maker of one product and a reseller of
// another, and a hint that hides which one would invite the very substitution
// the review exists to prevent.
const sameCas = (left, right) => String(left || '').trim() === String(right || '').trim()

const decisionLine = item => <>
  {decisionLabels[item.decision] || statusLabel(item.decision)}
  {shortDate(item.decidedAt) && `, ${shortDate(item.decidedAt)}`}
  {item.casNumber && <> — CAS <code>{item.casNumber}</code></>}
  {item.productName && ` (${item.productName})`}
</>

function KnownSupplierNote({ known, requestedCas, compact }) {
  if (!known?.supplierId) return null
  // A company already in the directory but with no verdict on any substance
  // still carries a marking on its card. Showing it keeps the reviewer from
  // re-deciding what a colleague has already decided — while the wording says
  // plainly that this is the company-level answer, not one about this CAS.
  if (!known.decisions?.length) {
    if (!known.businessRole || known.businessRole === 'UNKNOWN') return null
    const summary = `Уже в справочнике, отмечен как: ${businessRoleLabel(known.businessRole).toLowerCase()}`
    return compact
      ? <small className="pr-known-supplier pr-known-supplier--compact">{summary}</small>
      : <div className="pr-known-supplier"><strong>Уже в справочнике</strong><p>{summary} — {businessRoleSourceLabels[known.businessRoleSource] || 'без основания'}. По этому веществу решения ещё нет.</p><Link to={`/procurement/suppliers/${known.supplierId}`}>Открыть карточку поставщика</Link></div>
  }
  const byDate = [...known.decisions].sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0))
  // The warning below is only true of a decision made on another substance.
  // Printing it over a decision about this very CAS would state something the
  // reader can see is false, on the one point this contour asks to be trusted on.
  const here = byDate.filter(item => sameCas(item.casNumber, requestedCas))
  const elsewhere = byDate.filter(item => !sameCas(item.casNumber, requestedCas))

  if (compact) {
    const [first] = here.length ? here : elsewhere
    const label = decisionLabels[first.decision] || statusLabel(first.decision)
    return <small className="pr-known-supplier pr-known-supplier--compact">
      Уже в справочнике: {label}{here.length ? '' : ' — по другому веществу'}
    </small>
  }

  return (
    <div className="pr-known-supplier">
      <strong>Уже в справочнике</strong>
      {here.length > 0 && (
        <>
          <p>По этому веществу: {decisionLine(here[0])}.</p>
          {here.length > 1 && <ul>{here.slice(1).map((item, index) => <li key={`here-${index}`}>{decisionLine(item)}</li>)}</ul>}
        </>
      )}
      {elsewhere.length > 0 && (
        <>
          <p>По другим веществам: {decisionLine(elsewhere[0])}.</p>
          {elsewhere.length > 1 && <ul>{elsewhere.slice(1).map((item, index) => <li key={`other-${index}`}>{decisionLine(item)}</li>)}</ul>}
          <p className="pr-note">Решение по другому веществу на эту карточку не переносится: роль привязана к веществу, а не к компании.</p>
        </>
      )}
      {known.supplierId && <Link to={`/procurement/suppliers/${known.supplierId}`}>Открыть карточку поставщика</Link>}
    </div>
  )
}

function ScoringRules({ rows, tone }) {
  return <dl className={`pr-sourcing-scoring__rules pr-sourcing-scoring__rules--${tone}`}>{rows.map(([weight, text]) => <div key={`${weight}-${text}`}><dt>{weight}</dt><dd>{text}</dd></div>)}</dl>
}

function ScoreExplanation({ candidate }) {
  const notes = [...(candidate?.reliabilitySignals || []), ...(candidate?.riskSignals || [])]
  const sum = notes.reduce((total, item) => total + notePoints(item), 0)
  // The stored score is clamped to 0..100, so on a candidate with many risks the
  // lines above add up to less than the number on the badge. Saying so is better
  // than letting the reader think the arithmetic is broken.
  const clamped = candidate && notes.length > 0 && sum !== candidate.score
  return <details className="pr-sourcing-scoring">
    <summary>Как считается оценка и цвет</summary>
    {clamped && <p className="pr-note">Сумма пунктов выше — {sum}, показано {candidate.score}: итог ограничен диапазоном 0–100.</p>}
    <p className="pr-note">Оценка — сумма правил ниже, ограниченная диапазоном 0–100. Она считается кодом, а не моделью: каждое слагаемое требует доказательства с дословной цитатой из сохранённого источника. Модель только извлекает доказательства и не влияет ни на баллы, ни на цвет.</p>
    <div className="pr-sourcing-scoring__grid">
      <section><h4>Добавляет</h4><ScoringRules rows={scoringAdds} tone="good" /></section>
      <section><h4>Вычитает</h4><ScoringRules rows={scoringSubtracts} tone="risk" /></section>
    </div>
    <h4>Цвет</h4>
    <ul className="pr-sourcing-scoring__lights">
      <li><StatusBadge status="RED" compact /><span>Найдено несоответствие продукту или явный негативный сигнал.</span></li>
      <li><StatusBadge status="GREEN" compact /><span>Одновременно: не менее 70 баллов, продукт <b>и</b> роль производителя подтверждены на официальном сайте компании, есть подтверждение регулятора либо независимых источников, и не найдено ни одного риска.</span></li>
      <li><StatusBadge status="YELLOW" compact /><span>Во всех остальных случаях.</span></li>
    </ul>
    <p className="pr-note">Отсюда обычная причина жёлтого статуса: если продукт и производство подтверждены только сторонними источниками, а официальный сайт компании в выдачу не попал, потолок оценки — около 20–40 баллов, и зелёный недостижим независимо от того, насколько компания известна. Что именно не хватает этому кандидату, перечислено в блоке «Пробелы».</p>
    <p className="pr-note">Зелёный статус — не проверка поставщика. Автоматическая оценка не может присвоить статус «подтверждённый производитель»: это делает только специалист явным решением.</p>
  </details>
}

// A run stored before the rating carried numbers holds plain strings here.
const noteText = item => (typeof item === 'string' ? item : item?.text || '')
const notePoints = item => (typeof item === 'string' ? 0 : Number(item?.points) || 0)
const notePotential = item => (typeof item === 'string' ? 0 : Number(item?.potential) || 0)

function NoteWeight({ item }) {
  const points = notePoints(item)
  if (points) return <span className={`pr-sourcing-weight pr-sourcing-weight--${points > 0 ? 'plus' : 'minus'}`}>{points > 0 ? `+${points}` : points}</span>
  const potential = notePotential(item)
  // A gap took nothing away — it is a bonus that was not awarded — so it says
  // what closing it would add rather than a penalty that never happened.
  if (potential) return <span className="pr-sourcing-weight pr-sourcing-weight--none">0 · <em>+{potential}, если появится</em></span>
  return null
}

function SignalList({ title, items, tone }) {
  if (!items?.length) return null
  return <div className={`pr-sourcing-signals pr-sourcing-signals--${tone}`}><h4>{title}</h4><ul>{items.map((item, index) => <li key={`${noteText(item)}-${index}`}>{noteText(item)} <NoteWeight item={item} /></li>)}</ul></div>
}

function ContactList({ contacts }) {
  if (!contacts?.length) return null
  return <div className="pr-sourcing-contacts"><h4>Контакты</h4><ul>{contacts.map((contact, index) => <li key={`${contact.address}-${index}`}>
    <strong>{contact.channel === 'email' ? 'email' : contact.channel}</strong>
    <span>{contact.address}</span>
    {externalUrl(contact.sourceUrl) && <a href={externalUrl(contact.sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink size={13} />откуда</a>}
    {contact.retrievedAt && <small>получено {formatDate(contact.retrievedAt)}</small>}
  </li>)}</ul><p className="pr-note">Найдено на сайте компании и не подтверждено. При добавлении в поставщики эти адреса переносятся в карточку поставщика.</p></div>
}

function SourceLink({ source }) {
  if (!source) return null
  const href = externalUrl(source.finalUrl || source.url)
  if (!href) return null
  return <a href={href} target="_blank" rel="noreferrer"><ExternalLink size={13} />{source.domain || 'Открыть источник'}</a>
}

export default function SourcingPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canResearchSourcing, canReviewSourcing, canOperateEchemi } = useProcurementPermissions()
  const [maxResults, setMaxResults] = useState('10')
  const [siteProbe, setSiteProbe] = useState(true)
  const [sourceUrl, setSourceUrl] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [reviewDecision, setReviewDecision] = useState('UNDER_REVIEW')
  const [reviewNote, setReviewNote] = useState('')
  const [promotionCandidateId, setPromotionCandidateId] = useState('')
  const [selectedQueryIds, setSelectedQueryIds] = useState(null)
  const [retryingSourceId, setRetryingSourceId] = useState('')
  const [selectedEngineIds, setSelectedEngineIds] = useState(null)

  const card = useQuery({ queryKey: procurementKeys.card(requestId), queryFn: ({ signal }) => procurementApi.card(requestId, signal) })
  const query = useQuery({
    queryKey: procurementKeys.sourcing(requestId),
    queryFn: ({ signal }) => procurementApi.sourcing(requestId, signal),
    // A finished run is still refetched while contacts are being collected: the
    // collection runs out of band and lands on the same document, so the page
    // shows addresses appearing rather than a button that did nothing. The
    // condition is the server's own state, not a guess at how long it takes.
    refetchInterval: data => data?.status === 'RUNNING' || data?.contactScan?.status === 'RUNNING'
      ? 3000
      : false,
  })
  const accept = run => {
    queryClient.setQueryData(procurementKeys.sourcing(requestId), run)
    if (run?.id) queryClient.setQueryData(procurementKeys.sourcingRun(run.id), run)
    queryClient.invalidateQueries({ queryKey: procurementKeys.card(requestId) })
  }
  const queryTemplates = useQuery({
    queryKey: procurementKeys.sourcingQueryTemplates(),
    queryFn: ({ signal }) => procurementApi.sourcingQueryTemplates(signal),
  })
  const templates = queryTemplates.data?.templates || []
  const effectiveQueryIds = selectedQueryIds ?? templates.filter(item => item.enabled).map(item => item.id)
  const saveTemplates = useMutation({
    mutationFn: payload => procurementApi.saveSourcingQueryTemplates(payload),
    onSuccess: data => {
      queryClient.setQueryData(procurementKeys.sourcingQueryTemplates(), data)
      setSelectedQueryIds(null)
    },
  })
  const engines = useQuery({
    queryKey: procurementKeys.sourcingEngines(),
    queryFn: ({ signal }) => procurementApi.sourcingEngines(signal),
  })
  const engineList = engines.data?.engines || []
  const availableEngineIds = engineList.filter(item => item.available).map(item => item.id)
  const effectiveEngineIds = (selectedEngineIds ?? availableEngineIds).filter(id => availableEngineIds.includes(id))
  const start = useMutation({
    mutationFn: () => procurementApi.startSourcing(requestId, Number(maxResults), effectiveQueryIds, effectiveEngineIds, siteProbe),
    onSuccess: accept,
  })
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelSourcing(query.data.id),
    onSuccess: accept,
  })
  const collectContacts = useMutation({
    mutationFn: () => procurementApi.collectSourcingContacts(query.data.id),
    // The server answers as soon as it has accepted the work, not when the work
    // is done, so the page keeps looking for a while rather than declaring it
    // finished immediately.
    onSuccess: accept,
  })
  const stopContacts = useMutation({
    mutationFn: () => procurementApi.stopSourcingContacts(query.data.id),
    onSuccess: accept,
  })
  const retrySource = useMutation({
    mutationFn: sourceId => procurementApi.retrySourcingSource(query.data.id, sourceId),
    onSuccess: run => { accept(run); setRetryingSourceId('') },
    onError: () => setRetryingSourceId(''),
  })
  const addSource = useMutation({
    mutationFn: () => procurementApi.addSourcingSource(query.data.id, sourceUrl.trim()),
    onSuccess: run => { accept(run); setSourceUrl('') },
  })
  const review = useMutation({
    mutationFn: () => procurementApi.reviewSourcingCandidate(query.data.id, selectedId, { decision: reviewDecision, note: reviewNote.trim() }),
    onSuccess: run => { accept(run); setReviewNote('') },
  })
  const promote = useMutation({
    mutationFn: candidateId => procurementApi.promoteSourcingCandidate(query.data.id, candidateId),
    onSuccess: supplier => {
      setPromotionCandidateId('')
      queryClient.invalidateQueries({ queryKey: procurementKeys.sourcing(requestId) })
      queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'suppliers'] })
      if (supplier?.id) queryClient.setQueryData(procurementKeys.supplier(supplier.id), current => current ? { ...current, supplier } : undefined)
    },
  })

  useEffect(() => {
    const candidates = query.data?.candidates || []
    if (!selectedId || !candidates.some(item => item.id === selectedId)) setSelectedId(candidates[0]?.id || '')
  }, [query.data?.candidates, selectedId])

  const run = query.data
  const candidate = useMemo(() => run?.candidates?.find(item => item.id === selectedId), [run, selectedId])
  const sourceMap = useMemo(() => new Map((run?.sources || []).map(item => [item.id, item])), [run])
  const counts = useMemo(() => (run?.candidates || []).reduce((result, item) => ({ ...result, [item.preliminaryStatus]: (result[item.preliminaryStatus] || 0) + 1 }), {}), [run])
  const operationError = start.error || addSource.error || review.error || promote.error || retrySource.error || cancel.error
  const normalized = card.data?.normalizationStatus === 'NORMALIZED'
  const isRunning = run?.status === 'RUNNING'
  const collectingContacts = run?.contactScan?.status === 'RUNNING'
  const isBusy = isRunning || start.isPending

  if (card.isLoading || query.isLoading) return <LoadingState />
  // Only when there is nothing to show. A running search polls every three
  // seconds, and one failed poll used to replace the whole page with a red
  // error: the results were still there, the screen simply stopped showing
  // them, and a reload brought everything back. Losing a finished search to a
  // moment of network trouble is worse than showing it with a warning.
  if (card.isError && !card.data) return <ErrorState error={card.error} onRetry={card.refetch} />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!card.data) return <EmptyState title="Карточка не найдена" />
  const staleError = query.isError ? query.error : card.isError ? card.error : null

  return <DetailLayout backTo={`/procurement/requests/${requestId}`} backLabel="К карточке" eyebrow={`Карточка #${requestId}`} title="Поиск и квалификация поставщиков" status={run ? <StatusBadge status={run.status} /> : <Badge variant="secondary">Не запускался</Badge>} meta={`CAS ${card.data.casNumber || '—'} · ${card.data.substanceName || 'вещество не указано'}`} warnings={<>
    {staleError && <Alert><CircleAlert /><AlertTitle>Показаны последние полученные данные</AlertTitle><AlertDescription>Связь с сервисом прервалась: {mutationMessage(staleError) || 'запрос не выполнен'}. Результаты ниже сохранены и никуда не делись — обновление продолжает повторяться само. <Button variant="outline" size="sm" onPress={() => { query.refetch(); card.refetch() }}>Обновить сейчас</Button></AlertDescription></Alert>}
    {!normalized && <Alert><AlertTriangle /><AlertTitle>Нужна нормализованная карточка</AlertTitle><AlertDescription>Перед поиском подтвердите CAS и название вещества. Это снижает риск смешения похожих продуктов.</AlertDescription></Alert>}
    {!canResearchSourcing && <Alert><AlertTriangle /><AlertTitle>Поиск доступен только для чтения</AlertTitle><AlertDescription>Для запуска и добавления источников требуется разрешение SOURCING_RESEARCH.</AlertDescription></Alert>}
    {operationError && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{mutationMessage(operationError)}</AlertDescription></Alert>}
  </>}>
    <div className="pr-stack">
      <Card className="pr-sourcing-launch"><CardHeader><div><CardTitle>Открытый поиск</CardTitle><p>Сайты производителей, регуляторы, разрешения, мощности, инвестпроекты, новости, каталоги и B2B-площадки.</p></div></CardHeader><CardContent>
        <label className="pr-sourcing-probe">
          <input type="checkbox" checked={siteProbe} onChange={event => setSiteProbe(event.target.checked)} disabled={isBusy} />
          <span>
            <strong>Проверять сайт кандидата</strong>
            Открывать каталог и страницу «О компании» у тех, кто заявил производство: каталог на тысячи веществ и описание вида «поставщик аналитических стандартов» видны только там. Читается правилами, без обращения к модели.
          </span>
        </label>
        <div className="pr-sourcing-launch__controls"><SelectField label="Лимит результатов" selectedKey={maxResults} onSelectionChange={value => setMaxResults(String(value))} isDisabled={isBusy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['1', '5', '10', '20', '50', '100'].map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField><Button isDisabled={!normalized || !canResearchSourcing || isBusy || !effectiveQueryIds.length || !effectiveEngineIds.length} onPress={() => start.mutate()}>{run ? <Refresh className={isBusy ? 'pr-spin' : undefined} /> : <Search className={isBusy ? 'pr-spin' : undefined} />}{isBusy ? 'Поиск выполняется…' : run ? 'Запустить новый поиск' : 'Начать поиск'}</Button>{isRunning && canResearchSourcing && <Button variant="outline" isDisabled={cancel.isPending} onPress={() => cancel.mutate()}><CircleAlert />{cancel.isPending ? 'Останавливаем…' : 'Остановить поиск'}</Button>}{run && !isRunning && canResearchSourcing && (collectingContacts
          ? <Button variant="outline" isDisabled={stopContacts.isPending} onPress={() => stopContacts.mutate()}><CircleAlert />{stopContacts.isPending ? 'Останавливаем…' : 'Остановить сбор'}</Button>
          : <Button variant="outline" isDisabled={collectContacts.isPending} onPress={() => collectContacts.mutate()}><Refresh className={collectContacts.isPending ? 'pr-spin' : undefined} />{collectContacts.isPending ? 'Запускаем…' : 'Собрать контакты'}</Button>)}</div>
        {run && !isRunning && <p className="pr-note">«Собрать контакты» перечитывает сайты найденных компаний и карточки в отраслевых каталогах. Доказательства и решения специалиста не затрагиваются — адрес устаревает сам по себе, и обновить его можно, не переискивая заново.</p>}
        {effectiveQueryIds.length > 0 && (() => {
          const per = perQueryResults(Number(maxResults), effectiveQueryIds.length)
          return <p className="pr-note pr-sourcing-limit-note">
            До {per} {plural(per, 'результата', 'результатов', 'результатов')}{effectiveQueryIds.length === 1 ? ' для единственного запроса' : ` на каждый из ${effectiveQueryIds.length} ${plural(effectiveQueryIds.length, 'запроса', 'запросов', 'запросов')}`} — по каждому выбранному движку. Охват растёт от числа запросов, а не от этого лимита.
          </p>
        })()}
        <EnginePicker engines={engineList} selectedIds={effectiveEngineIds} disabled={isBusy} onToggle={(id, checked) => setSelectedEngineIds(current => { const base = current ?? availableEngineIds; return checked ? [...new Set([...base, id])] : base.filter(value => value !== id) })} />
        <QueryPlanPanel templates={templates} isDefault={queryTemplates.data?.isDefault} selectedIds={effectiveQueryIds} onSelectionChange={(id, checked) => setSelectedQueryIds(current => { const base = current ?? templates.filter(item => item.enabled).map(item => item.id); return checked ? [...new Set([...base, id])] : base.filter(value => value !== id) })} onSave={async payload => { try { await saveTemplates.mutateAsync(payload); return true } catch { return false } }} onReset={() => saveTemplates.mutate((queryTemplates.data?.defaultTemplates || []).map(template => ({ template, enabled: true })))} isSaving={saveTemplates.isPending} saveError={saveTemplates.error} canEdit={canReviewSourcing} disabled={isBusy} cas={card.data?.casNumber} substanceName={card.data?.substanceName} />
        <p className="pr-note">Новый запуск создаёт отдельный снимок результатов. Система не присваивает статус производителя автоматически.</p>
        {canOperateEchemi && <details className="pr-sourcing-manual">
          {/* Collapsed by default: the unified run already covers Echemi as an
              engine, so this is the exception, not a second way to search. */}
          <summary>Ручная работа с площадками</summary>
          <p className="pr-note">Echemi участвует в общем поиске выше как источник заявок маркетплейса — отдельно запускать его не нужно. Ручной режим решает другую задачу: открыть карточку товара на площадке, заполнить форму обращения, проверить заполненные поля в браузере и отправить её после согласования.</p>
          <RouterLinkButton variant="outline" size="sm" to={`/procurement/requests/${requestId}/echemi`}><ExternalLink size={14} />Открыть Echemi вручную</RouterLinkButton>
        </details>}
      </CardContent></Card>

      {!run && <EmptyState title="Поиск ещё не запускался" description="После запуска здесь появятся источники, предварительный светофор и подтверждающие цитаты по каждому кандидату." />}

      {run && <>
        <SourcingProgress run={run} isRunning={isRunning} />
        <ContactScanProgress run={run} />
        <div className="pr-sourcing-kpis"><div className="is-neutral"><span>Кандидаты</span><strong>{run.candidates?.length || 0}</strong></div><div className="is-green"><span>Высокая уверенность</span><strong>{counts.GREEN || 0}</strong></div><div className="is-yellow"><span>Нужны доказательства</span><strong>{counts.YELLOW || 0}</strong></div><div className="is-red"><span>Высокий риск</span><strong>{counts.RED || 0}</strong></div><div className="is-ink"><span>Источники</span><strong>{run.sources?.length || 0}</strong></div></div>

        <Alert><AlertTriangle /><AlertTitle>Светофор — предварительная оценка</AlertTitle><AlertDescription>Рейтинг объясняет найденные сигналы, но не является верификацией. Подтвердить роль компании может только уполномоченный специалист после изучения доказательств.</AlertDescription></Alert>

        <div className="pr-sourcing-workbench">
          <Card><CardHeader><CardTitle>Кандидаты</CardTitle><span>{run.candidates?.length || 0} найдено</span></CardHeader><CardContent>{!run.candidates?.length ? <EmptyState title={isRunning ? 'Анализируем источники' : 'Кандидаты не найдены'} description={isRunning ? 'Первые кандидаты появятся здесь сразу после обработки подтверждающего источника.' : 'Добавьте релевантный источник вручную или запустите новый поиск с большим лимитом.'} /> : <div className="pr-sourcing-candidates">{run.candidates.map(item => <button type="button" key={item.id} className={selectedId === item.id ? 'is-selected' : ''} onClick={() => { setSelectedId(item.id); setPromotionCandidateId('') }}><Score candidate={item} /><span><strong>{item.name}</strong><small>{item.country || 'Страна не определена'} · {statusLabel(item.role)}</small><span className="pr-sourcing-badges"><StatusBadge status={item.preliminaryStatus} compact /><StatusBadge status={item.reviewDecision} compact /></span><KnownSupplierNote known={item.knownSupplier} requestedCas={run.requestedCas} compact /></span></button>)}</div>}</CardContent></Card>

          {candidate && <div className="pr-sourcing-detail">
            <Card><CardHeader><div><CardTitle>{candidate.name}</CardTitle><p>{candidate.aliases?.length ? `Также: ${candidate.aliases.join(', ')}` : 'Другие названия не найдены'}</p></div><StatusBadge status={candidate.preliminaryStatus} /></CardHeader><CardContent>
              <div className="pr-sourcing-identity"><Score candidate={candidate} /><div><span>Предполагаемая роль</span><strong>{statusLabel(candidate.role)}</strong></div><div><span>Страна</span><strong>{candidate.country || 'Не определена'}</strong></div>{externalUrl(candidate.website) && <a href={externalUrl(candidate.website)} target="_blank" rel="noreferrer"><ExternalLink />Сайт компании</a>}</div>
              <KnownSupplierNote known={candidate.knownSupplier} requestedCas={run.requestedCas} />
              <div className="pr-sourcing-signal-grid"><SignalList title="Надёжность" items={candidate.reliabilitySignals} tone="good" /><SignalList title="Риски" items={candidate.riskSignals} tone="risk" /><SignalList title="Пробелы" items={candidate.evidenceGaps} tone="gap" /></div>
              <ContactList contacts={candidate.contacts} />
              <ScoreExplanation candidate={candidate} />
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Проверяемые доказательства</CardTitle><span>{candidate.evidence?.length || 0} утверждений</span></CardHeader><CardContent>{!candidate.evidence?.length ? <EmptyState title="Доказательств пока нет" /> : <div className="pr-sourcing-evidence">{candidate.evidence.map(claim => <article key={claim.id} className={`is-${claim.polarity?.toLowerCase()}`}><header><strong>{evidenceLabels[claim.category] || claim.category}</strong><StatusBadge status={claim.polarity} compact /></header><p>{claim.value}</p><blockquote>{claim.quote}</blockquote><footer><SourceLink source={sourceMap.get(claim.sourceId)} /><span>Получено {formatDate(claim.sourceRetrievedAt)}</span>{claim.validUntil && <span>Действует до {claim.validUntil}</span>}</footer></article>)}</div>}</CardContent></Card>

            <Card><CardHeader><CardTitle>Решение специалиста</CardTitle><StatusBadge status={candidate.reviewDecision} /></CardHeader><CardContent>
              {!canReviewSourcing ? <p className="pr-note">Для квалификации требуется разрешение SOURCING_REVIEW.</p> : <form className="pr-sourcing-review" onSubmit={event => { event.preventDefault(); if (reviewNote.trim()) review.mutate() }}><SelectField label="Решение" selectedKey={reviewDecision} onSelectionChange={setReviewDecision}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reviewOptions.map(([value, label]) => <SelectItem key={value} id={value}>{label}</SelectItem>)}</SelectContent></SelectField><label className="pr-form-field"><span>Обоснование <b>*</b></span><Textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="Укажите, какие источники проверены и почему принято это решение." required /></label><Button type="submit" isDisabled={!reviewNote.trim() || review.isPending}>{review.isPending ? 'Сохранение…' : 'Сохранить решение'}</Button></form>}
              {candidate.reviewHistory?.length > 0 && <div className="pr-sourcing-history"><h4>История проверки</h4>{candidate.reviewHistory.map((item, index) => <div key={`${item.reviewedAt}-${index}`}><StatusBadge status={item.decision} compact /><p>{item.note}</p><span>{item.actorPrincipalKey} · {formatDate(item.reviewedAt)}</span></div>)}</div>}
              {candidate.promotedSupplierId ? <p className="pr-sourcing-promoted"><Check />Кандидат добавлен в справочник: <Link to={`/procurement/suppliers/${candidate.promotedSupplierId}`}>{candidate.promotedSupplierId}</Link></p> : ['VERIFIED_MANUFACTURER', 'VERIFIED_DISTRIBUTOR'].includes(candidate.reviewDecision) && canReviewSourcing && <div className="pr-sourcing-promote">{promotionCandidateId !== candidate.id ? <Button variant="outline" onPress={() => setPromotionCandidateId(candidate.id)}><Building />Добавить в поставщики</Button> : <div><p>Будет создан поставщик с подтверждённой capability по этой карточке и ссылками на доказательства.</p><div className="pr-inline-actions"><Button variant="outline" onPress={() => setPromotionCandidateId('')}>Отмена</Button><Button isDisabled={promote.isPending} onPress={() => promote.mutate(candidate.id)}>{promote.isPending ? 'Добавление…' : 'Подтвердить добавление'}</Button></div></div>}</div>}
            </CardContent></Card>
          </div>}
        </div>

        <Card><CardHeader><div><CardTitle>Источники поиска</CardTitle><p>Сохранённые URL и время получения обеспечивают трассируемость оценки.</p></div><span>{run.sources?.length || 0}</span></CardHeader><CardContent>
          {canResearchSourcing && <form className="pr-sourcing-add-source" onSubmit={event => { event.preventDefault(); if (sourceUrl.trim() && !isRunning) addSource.mutate() }}><label className="pr-form-field"><span>Добавить официальный документ или страницу</span><Input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://company.example/permits/..." isDisabled={isRunning} required /></label><Button type="submit" variant="outline" isDisabled={!sourceUrl.trim() || addSource.isPending || isRunning}>{addSource.isPending ? 'Добавление…' : isRunning ? 'Дождитесь завершения поиска' : 'Добавить и проанализировать'}</Button>{isRunning && <p className="pr-note">Ручной источник можно добавить после текущего запуска, чтобы результаты не перезаписали друг друга.</p>}</form>}
          <SourcingSourceTable sources={run.sources} engines={engineList} onRetry={sourceId => { setRetryingSourceId(sourceId); retrySource.mutate(sourceId) }} retryingId={retryingSourceId} canRetry={canResearchSourcing} isRunning={isRunning} />
          {run.queryPlan?.length > 0 && <details className="pr-sourcing-query-plan"><summary>Запросы, использованные в этом прогоне ({run.queryPlan.length})</summary><ol>{run.queryPlan.map(queryText => <li key={queryText}><code>{queryText}</code></li>)}</ol></details>}
        </CardContent></Card>
      </>}
    </div>
  </DetailLayout>
}
