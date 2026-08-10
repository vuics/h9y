import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { isUsableNegotiationContact } from '../api/negotiations'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ArrowLeft, MessageSquare } from '../components/icons'
import { SelectField } from '../components/SelectField'

export default function NegotiationFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { canManageNegotiations } = useProcurementPermissions()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const [cardId, setCardId] = useState(params.get('cardId') || '')
  const [supplierId, setSupplierId] = useState(params.get('supplierId') || '')
  const [contactId, setContactId] = useState('')
  const [authority, setAuthority] = useState('')
  const [followUpHours, setFollowUpHours] = useState('48')

  const cards = useQuery({
    queryKey: procurementKeys.cards({ page: 1, pageSize: 200 }),
    queryFn: ({ signal }) => procurementApi.cards({ page: 1, pageSize: 200 }, signal),
  })
  const suppliers = useQuery({
    queryKey: procurementKeys.suppliers({ page: 1, pageSize: 200, cardId }),
    queryFn: ({ signal }) => procurementApi.suppliers({ page: 1, pageSize: 200, cardId }, signal),
    enabled: Boolean(cardId),
  })
  const supplier = useQuery({
    queryKey: procurementKeys.supplier(supplierId),
    queryFn: ({ signal }) => procurementApi.supplier(supplierId, signal),
    enabled: Boolean(supplierId),
  })
  const approvedCards = cards.data?.items.filter(card => card.rfqStatus === 'APPROVED') || []
  const usableContacts = (supplier.data?.supplier?.contacts || []).filter(isUsableNegotiationContact)

  useEffect(() => {
    if (supplierId && suppliers.data && !suppliers.data.items.some(item => item.id === supplierId)) {
      setSupplierId('')
      setContactId('')
    }
  }, [supplierId, suppliers.data])
  useEffect(() => {
    if (contactId && !usableContacts.some(item => item.id === contactId)) setContactId('')
  }, [contactId, usableContacts])

  const mutation = useMutation({
    mutationFn: () => procurementApi.createNegotiation({
      card_id: Number(cardId), supplier_id: supplierId, contact_id: contactId,
      authority: authority.trim(),
      follow_up_after_hours: followUpHours ? Number(followUpHours) : null,
    }),
    onSuccess: negotiation => {
      queryClient.setQueryData(procurementKeys.negotiation(negotiation.id), negotiation)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/negotiations/${negotiation.id}`, { replace: true })
    },
  })

  const valid = cardId && supplierId && contactId && (!followUpHours || Number(followUpHours) > 0)
  if (!canManageNegotiations) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для создания задания требуется NEGOTIATION_MANAGE.</AlertDescription></Alert>

  return <div className="pr-card-form-page">
    <Button variant="ghost" size="sm" onPress={() => navigate('/procurement/negotiations')}><ArrowLeft />Все переговоры</Button>
    <div className="pr-section-heading"><div><h2>Новое переговорное задание</h2><p>Свяжите согласованный RFQ с конкретным поставщиком и контактом. Создание задания ничего не отправляет.</p></div></div>
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Задание не создано</AlertTitle><AlertDescription>{mutation.error?.response?.data?.message || mutation.error?.message}</AlertDescription></Alert>}
    {cards.isError && <Alert><AlertTriangle /><AlertTitle>Карточки недоступны</AlertTitle><AlertDescription>{cards.error?.message}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Связанные сущности</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (valid) mutation.mutate() }}>
      <SelectField label="Карточка с согласованным RFQ" required wide selectedKey={cardId || null} onSelectionChange={value => { setCardId(String(value)); setContactId('') }} isDisabled={cards.isLoading} hint={!cards.isLoading && approvedCards.length === 0 && <small>Нет карточек с RFQ в статусе APPROVED.</small>}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{approvedCards.map(card => <SelectItem id={String(card.id)} key={card.id}>#{card.id} · {card.title} · {card.rfqStatus}</SelectItem>)}</SelectContent></SelectField>
      <SelectField label="Поставщик с capability для CAS" required wide selectedKey={supplierId || null} onSelectionChange={value => { setSupplierId(String(value)); setContactId('') }} isDisabled={!cardId || suppliers.isLoading} hint={cardId && !suppliers.isLoading && suppliers.data?.items.length === 0 && <small>Для CAS карточки не найдено зарегистрированных поставщиков.</small>}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{suppliers.data?.items.map(item => <SelectItem id={item.id} key={item.id}>{item.name} · {item.qualificationStatus}</SelectItem>)}</SelectContent></SelectField>
      <SelectField label="Активный контакт" required wide selectedKey={contactId || null} onSelectionChange={value => setContactId(String(value))} isDisabled={!supplierId || supplier.isLoading} hint={supplierId && !supplier.isLoading && usableContacts.length === 0 && <small>Нет пригодного активного контакта. XMPP-контакт должен иметь статус VERIFIED.</small>}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{usableContacts.map(contact => <SelectItem id={contact.id} key={contact.id}>{contact.name || contact.role || contact.id} · {contact.channel} · {contact.address || 'адрес скрыт'}</SelectItem>)}</SelectContent></SelectField>
      <label className="pr-form-field pr-form-field--wide"><span>Полномочия negotiator</span><Textarea value={authority} onChange={event => setAuthority(event.target.value)} placeholder="Оставьте пустым, чтобы сервер применил безопасные полномочия по умолчанию: запрос лучших условий без права принять обязательства." /></label>
      <label className="pr-form-field"><span>Автоматический follow-up после действия, часов</span><Input type="number" min="1" step="1" value={followUpHours} onChange={event => setFollowUpHours(event.target.value)} /><small>Можно оставить пустым. Точное время также можно назначить позже на странице задания.</small></label>
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate('/procurement/negotiations')}>Отмена</Button><Button type="submit" isDisabled={!valid || mutation.isPending}><MessageSquare />{mutation.isPending ? 'Создание…' : 'Создать без отправки'}</Button></div>
    </form></CardContent></Card>
  </div>
}
