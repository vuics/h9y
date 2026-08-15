import React, { useEffect, useState } from 'react'
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

function TextField({ value, onChange, name, label, required, wide, ...props }) {
  return <label className={`pr-form-field${wide ? ' pr-form-field--wide' : ''}`}>
    <span>{label}{required && <> <b>*</b></>}</span>
    <Input {...props} required={required} value={value || ''} onChange={event => onChange({ [name]: event.target.value })} />
  </label>
}

function SenderEditor({ sender, index, setDraft, canEdit, defaultSenderId, onUseProfile, profileLoading, onRemove }) {
  const isDefault = sender.senderId === defaultSenderId
  const update = change => setDraft(current => ({
    ...current,
    senders: current.senders.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item),
  }))
  const input = (name, label, props = {}) => <TextField name={name} label={label} value={sender[name]} onChange={update} disabled={!canEdit} {...props} />
  return <Card className={!sender.active ? 'pr-settings-sender pr-settings-sender--inactive' : 'pr-settings-sender'}>
    <CardHeader>
      <div>
        <CardTitle>{sender.displayName || `Новый отправитель ${index + 1}`}</CardTitle>
        <p className="pr-note">
          {isDefault ? 'Отправитель по умолчанию' : sender.active ? 'Доступен для новых RFQ' : 'Неактивен'}
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
          onPress={onRemove}
        >
          <Trash size={14} />Удалить
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
  const { canManageBuyerSettings } = useProcurementPermissions()
  const query = useQuery({ queryKey: procurementKeys.buyerSettings(), queryFn: ({ signal }) => procurementApi.buyerSettings(signal) })
  const [draft, setDraft] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  useEffect(() => { if (query.data) setDraft(clone(query.data)) }, [query.data])
  const save = useMutation({
    mutationFn: () => procurementApi.saveBuyerSettings(draft),
    onSuccess: value => {
      queryClient.setQueryData(procurementKeys.buyerSettings(), value)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      setDraft(clone(value))
    },
  })

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
  const setOrganization = change => setDraft(current => ({ ...current, organization: { ...current.organization, ...change } }))
  const orgInput = (name, label, props = {}) => <TextField name={name} label={label} value={organization[name]} onChange={setOrganization} disabled={!canManageBuyerSettings} {...props} />
  const activeSenders = draft.senders.filter(item => item.active !== false)
  // A disabled Save button with no explanation reads as a broken page: the user
  // fills the form, presses nothing, reloads, and sees their work gone.
  const blockers = []
  if (!organization.displayName.trim()) blockers.push('не задано название организации для поставщиков')
  if (activeSenders.length === 0) blockers.push('нет ни одного активного отправителя')
  activeSenders.forEach((item, index) => {
    const missing = [
      !item.displayName.trim() && 'имя',
      !item.email.trim() && 'email',
      !item.phoneCountry.trim() && 'код страны',
      !item.phoneNumber.trim() && 'телефон',
    ].filter(Boolean)
    if (missing.length) {
      blockers.push(`у отправителя «${item.displayName.trim() || `№${index + 1}`}» не заполнено: ${missing.join(', ')}`)
    }
  })
  if (activeSenders.length > 0 && !activeSenders.some(item => item.senderId === draft.defaultSenderId)) {
    blockers.push('отправитель по умолчанию не выбран или выключен')
  }
  const valid = blockers.length === 0

  return <div className="pr-stack">
    <div className="pr-section-heading"><div><h2>Настройки Procurement</h2><p>Реквизиты, которые видят поставщики. Они отделены от персонального профиля входа в HyperAgency.</p></div></div>
    {draft.source === 'ENV_LEGACY' && <Alert><AlertTriangle /><AlertTitle>Импортировано из окружения</AlertTitle><AlertDescription>Текущие значения показаны из PROCUREMENT_* переменных. После сохранения Procurement и Negotiator начнут использовать эту запись.</AlertDescription></Alert>}
    {!canManageBuyerSettings && <Alert><AlertTriangle /><AlertTitle>Только просмотр</AlertTitle><AlertDescription>Изменять организацию и отправителей может пользователь с разрешением BUYER_SETTINGS_MANAGE.</AlertDescription></Alert>}
    {save.isError && <Alert><AlertTriangle /><AlertTitle>Настройки не сохранены</AlertTitle><AlertDescription>{save.error?.response?.data?.message || save.error?.message}</AlertDescription></Alert>}
    {profileError && <Alert><AlertTriangle /><AlertTitle>Профиль не загружен</AlertTitle><AlertDescription>{profileError}</AlertDescription></Alert>}

    <Card><CardHeader><CardTitle><Building /> Организация-покупатель</CardTitle></CardHeader><CardContent><div className="pr-card-form">
      {orgInput('displayName', 'Название для поставщиков', { required: true })}
      {orgInput('legalName', 'Юридическое название')}
      {orgInput('country', 'Страна', { maxLength: 2 })}
      {orgInput('website', 'Сайт', { type: 'url' })}
      {orgInput('address', 'Адрес организации', { wide: true })}
      <label className="pr-form-field pr-form-field--wide"><span>Описание компании</span><Textarea disabled={!canManageBuyerSettings} value={organization.description || ''} onChange={event => setOrganization({ description: event.target.value })} placeholder="Факты, которые допустимо использовать в сообщениях поставщикам" /></label>
    </div></CardContent></Card>

    <div className="pr-section-heading"><div><h3>Команда и отправители</h3><p>Каждый RFQ сохраняет выбранного отправителя как неизменяемый снимок.</p></div>{canManageBuyerSettings && <Button variant="outline" onPress={() => setDraft(current => { const sender = newSender(); return { ...current, senders: [...current.senders, sender], defaultSenderId: current.defaultSenderId || sender.senderId } })}><Plus />Добавить отправителя</Button>}</div>
    <label className="pr-form-field"><span>Отправитель по умолчанию <b>*</b></span><select disabled={!canManageBuyerSettings} value={draft.defaultSenderId || ''} onChange={event => setDraft(current => ({ ...current, defaultSenderId: event.target.value }))}>{activeSenders.map(sender => <option key={sender.senderId} value={sender.senderId}>{sender.displayName || sender.email || 'Без имени'}</option>)}</select></label>
    <div className="pr-settings-senders">{draft.senders.map((sender, index) => <SenderEditor key={sender.senderId || index} sender={sender} index={index} setDraft={setDraft} canEdit={canManageBuyerSettings} defaultSenderId={draft.defaultSenderId} onUseProfile={useAccountProfile} profileLoading={profileLoading} onRemove={() => setDraft(current => ({ ...current, senders: current.senders.filter((_, position) => position !== index) }))} />)}</div>
    {canManageBuyerSettings && blockers.length > 0 && <Alert><AlertTriangle /><AlertTitle>Пока нельзя сохранить</AlertTitle><AlertDescription><ul className="pr-blocker-list">{blockers.map(item => <li key={item}>{item}</li>)}</ul></AlertDescription></Alert>}
    {canManageBuyerSettings && <div className="pr-form-actions"><Button variant="outline" isDisabled={save.isPending} onPress={() => setDraft(clone(query.data))}>Отменить изменения</Button><Button isDisabled={!valid || save.isPending} onPress={() => save.mutate()}>{save.isPending ? 'Сохранение…' : 'Сохранить настройки'}</Button></div>}
  </div>
}
