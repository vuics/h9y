import React, { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import conf from '../../../conf'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Building, Plus, Trash } from '../components/icons'

const clone = value => JSON.parse(JSON.stringify(value))

// The server rejects these shapes anyway. Checking them here is what turns a
// rejected save into a field the user can see and fix before pressing anything.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const COUNTRY_RE = /^[A-Za-z]{2}$/
const PHONE_RE = /^[0-9+() .-]+$/
const WEBSITE_RE = /^https?:\/\//

const SENDER_FIELD_LABELS = {
  display_name: 'Имя для поставщиков',
  displayName: 'Имя для поставщиков',
  job_title: 'Должность',
  department: 'Подразделение',
  email: 'Рабочий email',
  phone_country: 'Страна телефона',
  phoneCountry: 'Страна телефона',
  phone_number: 'Телефон',
  phoneNumber: 'Телефон',
  preferred_language: 'Язык коммуникации',
  signature: 'Подпись',
}

const ORGANIZATION_FIELD_LABELS = {
  display_name: 'Название для поставщиков',
  legal_name: 'Юридическое название',
  country: 'Страна',
  website: 'Сайт',
  address: 'Адрес организации',
  description: 'Описание компании',
}

/* A rejected save names the field the way the API spells it —
   `senders.1.phone_number`. Nobody counts senders from zero to find their own
   form, so the message is rewritten to point at the card by its name. */
function describeServerError(message, senders) {
  const text = String(message || '')
  const sender = text.match(/senders\.(\d+)\.([A-Za-z_]+)/)
  if (sender) {
    const item = senders?.[Number(sender[1])]
    const who = item?.displayName?.trim() || item?.email?.trim() || `№${Number(sender[1]) + 1}`
    const field = SENDER_FIELD_LABELS[sender[2]] || sender[2]
    return `Отправитель «${who}», поле «${field}» заполнено в недопустимом формате.`
  }
  const organization = text.match(/organization\.([A-Za-z_]+)/)
  if (organization) {
    const field = ORGANIZATION_FIELD_LABELS[organization[1]] || organization[1]
    return `Реквизиты организации: поле «${field}» заполнено в недопустимом формате.`
  }
  return text
}

const newSender = () => ({
  senderId: `SENDER-${Date.now()}`,
  userId: null,
  displayName: '',
  jobTitle: '',
  department: 'Procurement',
  email: '',
  phoneCountry: 'RU',
  phoneNumber: '',
  preferredLanguage: 'en',
  signature: '',
  active: true,
})

function TextField({ value, onChange, name, label, required, wide, invalid, ...props }) {
  return <label className={`pr-form-field${wide ? ' pr-form-field--wide' : ''}`}>
    <span>{label}{required && <> <b>*</b></>}</span>
    <Input {...props} required={required} aria-invalid={invalid ? true : undefined} value={value || ''} onChange={event => onChange({ [name]: event.target.value })} />
    {invalid && <small className="pr-field-error">{invalid}</small>}
  </label>
}

function SenderEditor({ sender, index, setDraft, canEdit, defaultSenderId, onUseProfile, profileLoading, onRemove, onRestore, issues }) {
  const isDefault = sender.senderId === defaultSenderId
  const removed = sender.removed === true
  const update = change => setDraft(current => ({
    ...current,
    senders: current.senders.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item),
  }))
  const input = (name, label, props = {}) => <TextField name={name} label={label} value={sender[name]} onChange={update} disabled={!canEdit} invalid={issues?.[name]} {...props} />
  const hasIssues = Object.keys(issues || {}).length > 0
  return <Card className={`${!sender.active ? 'pr-settings-sender pr-settings-sender--inactive' : 'pr-settings-sender'}${hasIssues ? ' pr-settings-sender--invalid' : ''}${removed ? ' pr-settings-sender--removed' : ''}`}>
    <CardHeader>
      <div>
        <CardTitle>{sender.displayName || `Новый отправитель ${index + 1}`}</CardTitle>
        <p className="pr-note">
          {removed
            ? 'Будет удалён при сохранении'
            : isDefault ? 'Отправитель по умолчанию' : sender.active ? 'Доступен для новых RFQ' : 'Неактивен'}
          {sender.email ? ` · ${sender.email}` : ''}
        </p>
      </div>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          /* The default sender cannot be removed: doing so would leave the
             workspace unable to prepare an RFQ at all. Pick another default
             first. */
          isDisabled={isDefault}
          onPress={removed ? onRestore : onRemove}
        >
          {removed ? <>Вернуть</> : <><Trash size={14} />Удалить</>}
        </Button>
      )}
    </CardHeader>
    <CardContent>{canEdit && <div className="pr-inline-actions pr-settings-profile-action"><Button variant="outline" size="sm" isDisabled={profileLoading} onPress={() => onUseProfile(index)}>{profileLoading ? 'Загрузка профиля…' : 'Подставить из моего профиля'}</Button></div>}<div className="pr-card-form">
      {input('displayName', 'Имя для поставщиков', { required: true })}
      {input('jobTitle', 'Должность')}
      {input('department', 'Подразделение')}
      {input('email', 'Рабочий email', { type: 'email', required: true })}
      {input('phoneCountry', 'Страна телефона', { maxLength: 2, required: true })}
      {input('phoneNumber', 'Телефон', { required: true })}
      {input('preferredLanguage', 'Язык коммуникации')}
      <label className="pr-form-field pr-form-field--wide"><span>Подпись</span><Textarea disabled={!canEdit} value={sender.signature || ''} onChange={event => update({ signature: event.target.value })} placeholder="Необязательная дополнительная подпись" /></label>
      <label className="pr-settings-check"><input type="checkbox" disabled={!canEdit || sender.senderId === defaultSenderId} checked={sender.active !== false} onChange={event => update({ active: event.target.checked })} /><span>Активен для новых коммуникаций</span></label>
    </div></CardContent>
  </Card>
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { canManageBuyerSettings, canManageSenders, echemiSubmissionEnabled } = useProcurementPermissions()
  const query = useQuery({ queryKey: procurementKeys.buyerSettings(), queryFn: ({ signal }) => procurementApi.buyerSettings(signal) })
  const [draft, setDraft] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  useEffect(() => { if (query.data) setDraft(clone(query.data)) }, [query.data])
  const save = useMutation({
    // A sender marked for removal stays in the draft so the card can say so;
    // it is dropped only when the save actually goes out.
    mutationFn: () => procurementApi.saveBuyerSettings({
      ...draft,
      senders: draft.senders.filter(sender => sender.removed !== true),
    }),
    onSuccess: value => {
      queryClient.setQueryData(procurementKeys.buyerSettings(), value)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      setDraft(clone(value))
    },
  })
  const saveErrorRef = useRef(null)
  // The Save button sits at the bottom of a long form. An error rendered
  // anywhere else is an error nobody reads, so the page goes to it.
  useEffect(() => {
    if (save.isError && saveErrorRef.current) {
      saveErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [save.isError, save.error])
  // Settings live only in this component until they are saved. Reloading after
  // a rejected save used to discard the work silently.
  useEffect(() => {
    if (!draft || !query.data) return undefined
    if (JSON.stringify(draft) === JSON.stringify(query.data)) return undefined
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft, query.data])

  const useAccountProfile = async index => {
    setProfileLoading(true)
    setProfileError('')
    try {
      const response = await axios.get(`${conf.api.url}/profile`, { withCredentials: true })
      const profile = response.data || {}
      setDraft(current => ({
        ...current,
        senders: current.senders.map((sender, senderIndex) => senderIndex === index ? {
          ...sender,
          displayName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || sender.displayName,
          email: profile.email || sender.email,
          phoneNumber: profile.phone || sender.phoneNumber,
          phoneCountry: profile.address?.country || sender.phoneCountry,
        } : sender),
      }))
    } catch (error) {
      setProfileError(error?.response?.data?.message || error.message)
    } finally {
      setProfileLoading(false)
    }
  }

  if (query.isLoading || !draft) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const organization = draft.organization
  const dirty = JSON.stringify(draft) !== JSON.stringify(query.data)
  const setOrganization = change => setDraft(current => ({ ...current, organization: { ...current.organization, ...change } }))
  const orgInput = (name, label, props = {}) => <TextField name={name} label={label} value={organization[name]} onChange={setOrganization} disabled={!canManageBuyerSettings} {...props} />
  const keptSenders = draft.senders.filter(item => item.removed !== true)
  const activeSenders = keptSenders.filter(item => item.active !== false)
  // A disabled Save button with no explanation reads as a broken page: the user
  // fills the form, presses nothing, reloads, and sees their work gone.
  // Every sender in the list is validated, not only the active ones: the server
  // validates the whole array, so an inactive card with a bad phone rejects the
  // save just as loudly and used to do it invisibly.
  const senderIssues = draft.senders.map(item => {
    const issues = {}
    if (item.removed === true) return issues
    const displayName = (item.displayName || '').trim()
    const email = (item.email || '').trim()
    const phoneCountry = (item.phoneCountry || '').trim()
    const phoneNumber = (item.phoneNumber || '').trim()
    if (!displayName) issues.displayName = 'Укажите имя, которое увидит поставщик'
    if (!email) issues.email = 'Укажите рабочий email'
    else if (!EMAIL_RE.test(email)) issues.email = 'Адрес вида name@company.com'
    if (!phoneCountry) issues.phoneCountry = 'Укажите код страны'
    else if (!COUNTRY_RE.test(phoneCountry)) issues.phoneCountry = 'Две латинские буквы, например RU'
    if (!phoneNumber) issues.phoneNumber = 'Укажите телефон'
    else if (!PHONE_RE.test(phoneNumber)) issues.phoneNumber = 'Только цифры и символы + ( ) . -'
    else if (phoneNumber.length < 5) issues.phoneNumber = 'Не короче пяти символов'
    return issues
  })

  const blockers = []
  if (!organization.displayName.trim()) {
    // A specialist cannot fix this one themselves, so saying "fill it in" would
    // send them looking for a field they are not allowed to edit.
    blockers.push(canManageBuyerSettings
      ? 'не задано название организации для поставщиков'
      : 'не задано название организации для поставщиков — его задаёт администратор')
  }
  const organizationCountry = (organization.country || '').trim()
  if (organizationCountry && !COUNTRY_RE.test(organizationCountry)) {
    blockers.push('страна организации — две латинские буквы, например RU')
  }
  const organizationWebsite = (organization.website || '').trim()
  if (organizationWebsite && !WEBSITE_RE.test(organizationWebsite)) {
    blockers.push('сайт организации должен начинаться с http:// или https://')
  }
  if (activeSenders.length === 0) blockers.push('нет ни одного активного отправителя')
  draft.senders.forEach((item, index) => {
    if (item.removed === true) return
    const issues = senderIssues[index]
    const listed = Object.entries(issues)
    if (!listed.length) return
    const who = (item.displayName || '').trim() || (item.email || '').trim() || `№${index + 1}`
    const details = listed
      .map(([field, hint]) => `${SENDER_FIELD_LABELS[field] || field} — ${hint.toLowerCase()}`)
      .join('; ')
    blockers.push(`у отправителя «${who}»: ${details}`)
  })
  if (activeSenders.length > 0 && !activeSenders.some(item => item.senderId === draft.defaultSenderId)) {
    blockers.push('отправитель по умолчанию не выбран или выключен')
  }
  const valid = blockers.length === 0

  return <div className="pr-stack">
    <div className="pr-section-heading"><div><h2>Настройки Procurement</h2><p>Реквизиты, которые видят поставщики. Они отделены от персонального профиля входа в HyperAgency.</p></div></div>
    {draft.usedByAgent === false && <Alert><AlertTriangle /><AlertTitle>Эти настройки не использует ни один агент</AlertTitle><AlertDescription>{draft.scopeNote} Чтобы они попали в RFQ, войдите под учётной записью, которой принадлежит развёрнутый Procurement Agent, и задайте отправителя там — или разверните агента под этой учётной записью.</AlertDescription></Alert>}
    {draft.usedByAgent && <p className="pr-note">Рабочее место: <code>{draft.scope}</code>. {draft.scopeNote}</p>}
    {draft.source === 'ENV_LEGACY' && <Alert><AlertTriangle /><AlertTitle>Импортировано из окружения</AlertTitle><AlertDescription>Текущие значения показаны из PROCUREMENT_* переменных. После сохранения Procurement и Negotiator начнут использовать эту запись.</AlertDescription></Alert>}
    {!canManageSenders && <Alert><AlertTriangle /><AlertTitle>Только просмотр</AlertTitle><AlertDescription>Изменять отправителей может пользователь с разрешением SENDER_MANAGE, реквизиты организации — с BUYER_SETTINGS_MANAGE.</AlertDescription></Alert>}
    {canManageSenders && !canManageBuyerSettings && <Alert><AlertTriangle /><AlertTitle>Реквизиты организации меняет администратор</AlertTitle><AlertDescription>Вы можете добавлять и править отправителей и выбирать отправителя по умолчанию. Название и юридические реквизиты компании-покупателя изменяются с разрешением BUYER_SETTINGS_MANAGE, потому что ими определяется, от какого юрлица уходит запрос.</AlertDescription></Alert>}
    {profileError && <Alert><AlertTriangle /><AlertTitle>Профиль не загружен</AlertTitle><AlertDescription>{profileError}</AlertDescription></Alert>}

    <Card><CardHeader><CardTitle><Building /> Организация-покупатель</CardTitle></CardHeader><CardContent><div className="pr-card-form">
      {orgInput('displayName', 'Название для поставщиков', { required: true })}
      {orgInput('legalName', 'Юридическое название')}
      {orgInput('country', 'Страна', { maxLength: 2 })}
      {orgInput('website', 'Сайт', { type: 'url' })}
      {orgInput('address', 'Адрес организации', { wide: true })}
      <label className="pr-form-field pr-form-field--wide"><span>Описание компании</span><Textarea disabled={!canManageBuyerSettings} value={organization.description || ''} onChange={event => setOrganization({ description: event.target.value })} placeholder="Факты, которые допустимо использовать в сообщениях поставщикам" /></label>
    </div></CardContent></Card>

    <div className="pr-section-heading"><div><h3>Команда и отправители</h3><p>Каждый RFQ сохраняет выбранного отправителя как неизменяемый снимок: правка здесь меняет только будущие запросы и не затрагивает уже отправленные RFQ и идущие переговоры.</p></div>{canManageSenders && <Button variant="outline" onPress={() => setDraft(current => { const sender = newSender(); return { ...current, senders: [...current.senders, sender], defaultSenderId: current.defaultSenderId || sender.senderId } })}><Plus />Добавить отправителя</Button>}</div>
    <label className="pr-form-field"><span>Отправитель по умолчанию <b>*</b></span><select disabled={!canManageSenders} value={draft.defaultSenderId || ''} onChange={event => setDraft(current => ({ ...current, defaultSenderId: event.target.value }))}>{activeSenders.map(sender => <option key={sender.senderId} value={sender.senderId}>{sender.displayName || sender.email || 'Без имени'}</option>)}</select></label>
    <p className="pr-note">Отправители общие для всего рабочего места: изменение увидят все его пользователи.{draft.updatedAt ? ` Последнее изменение: ${new Date(draft.updatedAt).toLocaleString('ru-RU')}${draft.updatedBy ? `, ${draft.updatedBy}` : ''}.` : ''}</p>
    <div className="pr-settings-senders">{draft.senders.map((sender, index) => <SenderEditor key={sender.senderId || index} sender={sender} index={index} setDraft={setDraft} canEdit={canManageSenders} defaultSenderId={draft.defaultSenderId} onUseProfile={useAccountProfile} profileLoading={profileLoading} onRemove={() => setDraft(current => ({ ...current, senders: current.senders.map((item, position) => position === index ? { ...item, removed: true } : item) }))} onRestore={() => setDraft(current => ({ ...current, senders: current.senders.map((item, position) => position === index ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'removed')) : item) }))} issues={senderIssues[index]} />)}</div>

    <Card><CardHeader><CardTitle><Building /> Отправка форм на площадках</CardTitle></CardHeader><CardContent>
      <p className="pr-note">
        {echemiSubmissionEnabled
          ? 'Отправка форм на Echemi разрешена в этой инсталляции. Запрос уходит поставщику только после предпросмотра и явного согласования точных значений.'
          : 'Отправка форм на Echemi отключена в этой инсталляции. Поиск, подготовка, предпросмотр и согласование работают, кнопка отправки — нет.'}
      </p>
      <p className="pr-note">
        Это переключатель развёртывания <code>ECHEMI_ENABLE_SUBMISSION</code>, а не право пользователя: он подтверждает, что контур браузерной интеграции проверен. Его меняет администратор в конфигурации сервиса — из интерфейса он не редактируется намеренно, потому что это последний рубеж перед необратимой отправкой реальному поставщику.
      </p>
    </CardContent></Card>

    <div ref={saveErrorRef}>
      {save.isError && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Настройки не сохранены</AlertTitle><AlertDescription>
        <p>{describeServerError(save.error?.response?.data?.message || save.error?.message, draft.senders)}</p>
        <p className="pr-note"><code>{save.error?.response?.data?.message || save.error?.message}</code></p>
      </AlertDescription></Alert>}
    </div>
    {canManageSenders && blockers.length > 0 && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Пока нельзя сохранить</AlertTitle><AlertDescription><ul className="pr-blocker-list">{blockers.map(item => <li key={item}>{item}</li>)}</ul></AlertDescription></Alert>}
    {canManageSenders && dirty && <p className="pr-note pr-unsaved-note">Изменения ещё не сохранены — они применятся только по кнопке «Сохранить настройки».</p>}
    {canManageSenders && <div className="pr-form-actions"><Button variant="outline" isDisabled={save.isPending} onPress={() => setDraft(clone(query.data))}>Отменить изменения</Button><Button isDisabled={!valid || save.isPending} onPress={() => save.mutate()}>{save.isPending ? 'Сохранение…' : 'Сохранить настройки'}</Button></div>}
  </div>
}
