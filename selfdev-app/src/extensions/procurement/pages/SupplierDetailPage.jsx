import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ExternalLink, Flask, MessageSquare, Sliders } from '../components/icons'

const qualificationStatuses = ['UNVERIFIED', 'UNDER_REVIEW', 'QUALIFIED', 'SUSPENDED', 'REJECTED']

export default function SupplierDetailPage() {
  const { supplierId } = useParams()
  const queryClient = useQueryClient()
  const { canWriteSuppliers, canQualifySuppliers, canManageNegotiations } = useProcurementPermissions()
  const [qualification, setQualification] = useState('UNVERIFIED')
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState({ name: '', website: '', country: '', description: '' })
  const query = useQuery({ queryKey: procurementKeys.supplier(supplierId), queryFn: ({ signal }) => procurementApi.supplier(supplierId, signal) })
  const supplier = query.data?.supplier
  useEffect(() => { if (supplier?.qualificationStatus) setQualification(supplier.qualificationStatus) }, [supplier?.qualificationStatus])
  useEffect(() => {
    if (!supplier || isEditing) return
    setProfile({ name: supplier.name || '', website: supplier.website || '', country: supplier.country || '', description: supplier.description || '' })
  }, [supplier, isEditing])
  const saveProfile = useMutation({
    mutationFn: () => procurementApi.updateSupplierProfile(supplierId, {
      name: profile.name.trim(),
      website: profile.website.trim(),
      country: profile.country.trim(),
      description: profile.description.trim(),
    }),
    onSuccess: updated => {
      queryClient.setQueryData(procurementKeys.supplier(supplierId), current => ({ ...(current || {}), supplier: updated }))
      queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'suppliers'] })
      setIsEditing(false)
    },
  })
  const qualify = useMutation({
    mutationFn: () => procurementApi.updateSupplierQualification(supplierId, qualification),
    onSuccess: updated => {
      queryClient.setQueryData(procurementKeys.supplier(supplierId), current => ({ ...(current || {}), supplier: updated }))
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
    },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!supplier) return <EmptyState title="Поставщик не найден" />
  const { negotiations = [], proposals = [] } = query.data
  const actions = <>{canWriteSuppliers && !isEditing && <Button variant="outline" onPress={() => setIsEditing(true)}><Sliders />Редактировать карточку</Button>}{canManageNegotiations && <RouterLinkButton variant="outline" to={`/procurement/negotiations/new?supplierId=${supplier.id}`}><MessageSquare />Создать переговоры</RouterLinkButton>}{canWriteSuppliers && <RouterLinkButton variant="outline" to={`/procurement/suppliers/${supplier.id}/capabilities/new`}><Flask />Добавить capability</RouterLinkButton>}{canWriteSuppliers && <RouterLinkButton to={`/procurement/suppliers/${supplier.id}/contacts/new`}><MessageSquare />Добавить контакт</RouterLinkButton>}</>

  const profileCard = isEditing
    ? <Card><CardHeader><CardTitle>Карточка поставщика</CardTitle></CardHeader><CardContent>
      <form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (profile.name.trim()) saveProfile.mutate() }}>
        <label className="pr-form-field"><span>Название <b>*</b></span><Input value={profile.name} onChange={event => setProfile(value => ({ ...value, name: event.target.value }))} maxLength={200} required /></label>
        <label className="pr-form-field"><span>Сайт</span><Input type="url" value={profile.website} onChange={event => setProfile(value => ({ ...value, website: event.target.value }))} placeholder="https://supplier.example" maxLength={2048} /></label>
        <label className="pr-form-field"><span>Страна</span><Input value={profile.country} onChange={event => setProfile(value => ({ ...value, country: event.target.value }))} placeholder="CN" maxLength={56} /></label>
        <label className="pr-form-field pr-form-field--wide"><span>Описание</span><Textarea value={profile.description} onChange={event => setProfile(value => ({ ...value, description: event.target.value }))} maxLength={4000} placeholder="Чем занимается компания, что уже проверено, на что обратить внимание." /></label>
        <div className="pr-form-actions"><Button variant="outline" type="button" isDisabled={saveProfile.isPending} onPress={() => setIsEditing(false)}>Отмена</Button><Button type="submit" isDisabled={!profile.name.trim() || saveProfile.isPending}>{saveProfile.isPending ? 'Сохранение…' : 'Сохранить'}</Button></div>
      </form>
      <p className="pr-note">Прежнее название сохраняется как синоним, чтобы найденные ранее доказательства не потерялись. Статус квалификации, контакты и capabilities меняются отдельно.</p>
    </CardContent></Card>
    : (supplier.website || supplier.description || supplier.profileHistory?.length)
      ? <Card><CardHeader><CardTitle>Карточка поставщика</CardTitle></CardHeader><CardContent>
        <DefinitionGrid items={[{ label: 'Сайт', value: supplier.website ? <a href={supplier.website} target="_blank" rel="noreferrer"><ExternalLink size={14} />{supplier.website}</a> : '—' }, { label: 'Страна', value: supplier.country || '—' }]} />
        {supplier.description && <p className="pr-supplier-description">{supplier.description}</p>}
        {supplier.profileHistory?.length > 0 && <details className="pr-sourcing-query-plan"><summary>История правок ({supplier.profileHistory.length})</summary><ol>{[...supplier.profileHistory].reverse().map((item, index) => <li key={`${item.changedAt}-${index}`}>{item.field}: {item.fromValue || '—'} → {item.toValue || '—'} <small>{item.actorPrincipalKey} · {item.changedAt ? new Date(item.changedAt).toLocaleString('ru-RU') : ''}</small></li>)}</ol></details>}
      </CardContent></Card>
      : null

  return <DetailLayout backTo="/procurement/suppliers" backLabel="Все поставщики" eyebrow={supplier.id} title={supplier.name} status={<StatusBadge status={supplier.qualificationStatus} />} meta={supplier.country || 'Страна не указана'} actions={actions} warnings={<>{qualify.isError && <Alert><AlertTriangle /><AlertTitle>Квалификация не изменена</AlertTitle><AlertDescription>{qualify.error?.response?.data?.message || qualify.error?.message}</AlertDescription></Alert>}{saveProfile.isError && <Alert><AlertTriangle /><AlertTitle>Карточка не сохранена</AlertTitle><AlertDescription>{saveProfile.error?.response?.data?.message || saveProfile.error?.message}</AlertDescription></Alert>}</>}>
    {profileCard}
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Квалификация</CardTitle></CardHeader><CardContent>
      <DefinitionGrid items={[{ label: 'Текущий статус', value: <StatusBadge status={supplier.qualificationStatus} /> }, { label: 'Последнее изменение', value: supplier.qualificationUpdatedAt ? new Date(supplier.qualificationUpdatedAt).toLocaleString('ru-RU') : '—' }]} />
      {canQualifySuppliers && <div className="pr-qualification-control"><Select selectedKey={qualification} onSelectionChange={setQualification}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{qualificationStatuses.map(value => <SelectItem id={value} key={value}>{value}</SelectItem>)}</SelectContent></Select><Button isDisabled={qualification === supplier.qualificationStatus || qualify.isPending} onPress={() => qualify.mutate()}>{qualify.isPending ? 'Сохранение…' : 'Изменить статус'}</Button></div>}
      {!canQualifySuppliers && <p className="pr-note">Изменение статуса доступно пользователям с разрешением SUPPLIER_QUALIFY.</p>}
    </CardContent></Card>
      <Card><CardHeader><CardTitle>Источники записи</CardTitle></CardHeader><CardContent className="pr-source-profiles">{supplier.sourceProfiles?.length ? supplier.sourceProfiles.map((profile, index) => <div key={`${profile.source}-${profile.identity}-${index}`}><div><strong>{profile.source}</strong><span>{profile.identity || 'Идентификатор не указан'}</span></div><StatusBadge status={profile.profileStatus} compact /></div>) : <EmptyState title="Источники не указаны" />}</CardContent></Card></div>

    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Контакты</CardTitle></CardHeader><CardContent className="pr-contact-list">{supplier.contacts.length ? supplier.contacts.map(contact => <div key={contact.id}><div><strong>{contact.name || 'Контакт без имени'}</strong><span>{contact.role || contact.channel} · {contact.channel}{contact.formAdapterId ? ` · адаптер ${contact.formAdapterId}` : ''}</span><span>{contact.address || 'Адрес скрыт правами доступа'}</span></div><div><StatusBadge status={contact.active ? contact.verificationStatus : 'SUSPENDED'} compact />{canWriteSuppliers && <RouterLinkButton size="xs" variant="outline" to={`/procurement/suppliers/${supplier.id}/contacts/${contact.id}/edit`}>Изменить</RouterLinkButton>}</div></div>) : <EmptyState title="Контактов нет" />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Предлагаемые вещества</CardTitle></CardHeader><CardContent className="pr-capabilities">{supplier.capabilities.length ? supplier.capabilities.map(item => <div key={`${item.casNumber}-${item.source}-${item.sourceProductId || ''}`}><div><strong>{item.productName || `CAS ${item.casNumber}`}</strong><span>CAS {item.casNumber}</span></div><StatusBadge status={item.verificationStatus} />{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Источник</a>}<small>{item.source}{item.sourceProductId ? ` · ${item.sourceProductId}` : ''}</small></div>) : <EmptyState title="Capabilities не добавлены" />}</CardContent></Card></div>

    <Card><CardHeader><CardTitle>История квалификации</CardTitle></CardHeader><CardContent className="pr-qualification-history">{supplier.qualificationHistory?.length ? [...supplier.qualificationHistory].reverse().map((event, index) => <div key={`${event.changedAt}-${index}`}><StatusBadge status={event.toStatus} compact /><div><strong>{event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}</strong><span>{event.source}{event.actorPrincipalKey ? ` · ${event.actorPrincipalKey}` : ''}</span></div><time>{event.changedAt ? new Date(event.changedAt).toLocaleString('ru-RU') : '—'}</time></div>) : <EmptyState title="История пока пуста" />}</CardContent></Card>

    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Переговоры</CardTitle></CardHeader><CardContent className="pr-linked-list">{negotiations.length ? negotiations.map(item => <Link key={item.id} to={`/procurement/negotiations/${item.id}`}><div><strong>{item.cardTitle}</strong><span>{item.contactName} · {item.channel}</span></div><StatusBadge status={item.status} /></Link>) : <EmptyState title="Переговоров нет" />}</CardContent></Card><Card><CardHeader><CardTitle>Текущие предложения</CardTitle></CardHeader><CardContent className="pr-linked-list">{proposals.length ? proposals.map(item => <Link key={item.id} to={`/procurement/proposals/${item.id}`}><div><strong>{item.price ? `${item.price} ${item.currency}/${item.priceUnit}` : 'Цена не указана'}</strong><span>{item.id} · рев. {item.revision}</span></div><StatusBadge status={item.completeness} /></Link>) : <EmptyState title="Предложений нет" />}</CardContent></Card></div>
  </DetailLayout>
}
