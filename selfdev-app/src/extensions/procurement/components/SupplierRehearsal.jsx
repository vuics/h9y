import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { StatusBadge } from './StatusBadge'
import { RFQ_VERSIONS, rfqVersionText } from '../lib/rfqVersions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert, FileCheck, Flask } from './icons'

export const PERSONAS = [
  ['COOPERATIVE', 'Отвечает по существу'],
  ['TERSE', 'Односложно'],
  ['EVASIVE_ON_DOCUMENTS', 'Уклоняется от документов'],
  ['TRADER_CLAIMING_MANUFACTURER', 'Трейдер под видом производителя'],
  ['OFFERS_DIFFERENT_PRODUCT', 'Предлагает другой продукт'],
]

const mutationMessage = error => error?.response?.data?.message || error?.message

/**
 * Rehearse one supplier reply.
 *
 * Shared by the playbook settings page and the response form so the two cannot
 * drift into offering different personas or different disclaimers. `onUse` is
 * what makes it more than a toy: the caller decides what a rehearsed reply is
 * good for — filling a demo, or nothing at all.
 */
export function SupplierRehearsal({
  cardId,
  defaultMessage = '',
  country = '',
  onUse,
  useLabel = 'Подставить этот ответ',
  showRfqPicker = true,
}) {
  const [message, setMessage] = useState(defaultMessage)
  const [persona, setPersona] = useState('COOPERATIVE')
  const [simCountry, setSimCountry] = useState(country)
  const [version, setVersion] = useState('english_short')

  const rfq = useQuery({
    queryKey: procurementKeys.rfq(cardId),
    queryFn: ({ signal }) => procurementApi.rfq(cardId, signal),
    enabled: showRfqPicker && Boolean(cardId),
  })

  const simulate = useMutation({
    mutationFn: () => procurementApi.simulateSupplierReply({
      persona,
      message,
      cardId: cardId ? Number(cardId) : null,
      country: simCountry || null,
      language: version.startsWith('russian') ? 'ru' : 'en',
    }),
  })

  const available = rfqVersionText(rfq.data, version)

  return (
    <Card>
      <CardHeader>
        <CardTitle><Flask size={16} />Симулятор поставщика</CardTitle>
        <p className="pr-muted">
          Репетиция: модель играет поставщика и отвечает на ваше письмо, чтобы вы увидели,
          <strong> что письмо на самом деле вытянет</strong>, до того как его получит настоящий
          поставщик. Письмо может читаться отлично и при этом не получить MOQ.
        </p>
        <p className="pr-muted">
          Ответ синтетический. Он нигде не сохраняется: не попадает в предложения, в сравнение
          и в экспорт, и никому не отправляется.
        </p>
      </CardHeader>
      <CardContent>
        {showRfqPicker && cardId && (
          <div className="pr-form-field pr-form-field--wide">
            <span>Взять готовый RFQ карточки #{cardId}</span>
            <div className="pr-inline-actions">
              {RFQ_VERSIONS.map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={version === value ? 'secondary' : 'outline'}
                  onPress={() => setVersion(value)}
                >
                  {label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                isDisabled={!available}
                onPress={() => setMessage(available)}
              >
                <FileCheck size={14} />Подставить в письмо
              </Button>
            </div>
            {rfq.isLoading && <small className="pr-muted">Загружаем RFQ…</small>}
            {!rfq.isLoading && !available && (
              <small className="pr-muted">
                Этой версии RFQ у карточки пока нет — подготовьте её на экране RFQ или
                вставьте текст письма вручную.
              </small>
            )}
          </div>
        )}

        <div className="pr-form-field pr-form-field--wide">
          <span>Каким поставщиком играть</span>
          <div className="pr-inline-actions">
            {PERSONAS.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={persona === value ? 'secondary' : 'outline'}
                onPress={() => setPersona(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <label className="pr-form-field">
          <span>Страна поставщика</span>
          <Input
            value={simCountry}
            placeholder="CN"
            onChange={event => setSimCountry(event.target.value)}
          />
        </label>

        <label className="pr-form-field pr-form-field--wide">
          <span>Письмо, на которое отвечает поставщик</span>
          <Textarea
            rows={8}
            value={message}
            placeholder="Подставьте готовый RFQ кнопкой выше или вставьте свой текст"
            onChange={event => setMessage(event.target.value)}
          />
          <small className="pr-muted">
            Формулируйте пункты как вопросы поставщику. Утверждение вида «MOQ is 1 kg» модель
            примет как данность и не назовёт свой MOQ, и отчёт окажется оптимистичнее реальности.
          </small>
        </label>

        <Button isDisabled={!message.trim() || simulate.isPending} onPress={() => simulate.mutate()}>
          <Flask size={15} />{simulate.isPending ? 'Модель отвечает…' : 'Прогнать репетицию'}
        </Button>

        {simulate.isError && (
          <Alert>
            <CircleAlert />
            <AlertTitle>Репетиция не выполнена</AlertTitle>
            <AlertDescription>{mutationMessage(simulate.error)}</AlertDescription>
          </Alert>
        )}

        {simulate.data && (
          <div className="pr-preview-result">
            <div className="pr-inline-actions">
              <Badge>{simulate.data.personaLabel}</Badge>
              <Badge variant="outline">синтетический ответ, не сохраняется</Badge>
            </div>
            <pre className="pr-message-text">{simulate.data.reply}</pre>
            <h4>
              {simulate.data.stillMissing?.length
                ? `Останется дозапросить: ${simulate.data.stillMissing.length}`
                : 'Письмо вытянуло все отслеживаемые поля'}
            </h4>
            <ul className="pr-simulation-fields">
              {(simulate.data.fields || []).map(field => (
                <li key={field.field} className={field.elicited ? 'is-elicited' : 'is-missing'}>
                  <span>{field.label}</span>
                  <StatusBadge status={field.status} compact />
                </li>
              ))}
            </ul>
            {simulate.data.extractionError && (
              <p className="pr-muted">
                Разбор ответа не удался ({simulate.data.extractionError}) — показан только текст.
              </p>
            )}
            {onUse && (
              <Button variant="outline" onPress={() => onUse(simulate.data.reply)}>
                {useLabel}
              </Button>
            )}
            <p className="pr-muted">{simulate.data.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
