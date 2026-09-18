import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { CAMPAIGN_STATUS } from './CampaignStatusBadge'
import { SelectField } from './SelectField'
import { plural } from './SourcingSettings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle } from './icons'

/** Put the selected cards into a campaign that already exists.
 *
 * They join its queue and run with its current settings; a finished campaign
 * starts moving again for them. Offered beside "launch" so a list that grows
 * does not become a second campaign with the same settings typed twice.
 */
export function CampaignAddPanel({ cardIds, onCancel }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [campaignId, setCampaignId] = useState(null)
  const campaigns = useQuery({
    queryKey: procurementKeys.campaigns(),
    queryFn: ({ signal }) => procurementApi.campaigns(signal),
  })
  const open = (campaigns.data?.items || []).filter(item => item.status !== 'CANCELLED')
  const add = useMutation({
    mutationFn: () => procurementApi.addCampaignCards(campaignId, cardIds),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
      navigate(`/procurement/campaigns/${result.campaignId}`)
    },
  })
  const message = add.error?.response?.data?.detail?.message || add.error?.message

  return <Card className="pr-sourcing-launch"><CardHeader><div>
    <CardTitle>Добавить {cardIds.length} {plural(cardIds.length, 'вещество', 'вещества', 'веществ')} в кампанию</CardTitle>
    <p>Вещества встанут в очередь кампании и пройдут её текущие настройки. Уже входящие в неё пропускаются.</p>
  </div></CardHeader><CardContent>
    {add.error && <Alert><AlertTriangle /><AlertTitle>Не добавлено</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
    {open.length === 0 && !campaigns.isLoading
      ? <p className="pr-note">Нет кампаний, в которые можно добавить вещества.</p>
      : <SelectField label="Кампания" selectedKey={campaignId} onSelectionChange={key => setCampaignId(String(key))} isDisabled={campaigns.isLoading || add.isPending}>
        <SelectTrigger><SelectValue placeholder="Выберите кампанию" /></SelectTrigger>
        <SelectContent>
          {open.map(item => <SelectItem key={item.campaignId} id={item.campaignId}>
            {item.title} · {CAMPAIGN_STATUS[item.status] || item.status} · {item.campaignId}
          </SelectItem>)}
        </SelectContent>
      </SelectField>}
    <div className="pr-sourcing-launch__controls">
      <Button isDisabled={!campaignId || add.isPending} onPress={() => add.mutate()}>
        {add.isPending ? 'Добавляем…' : `Добавить ${cardIds.length}`}
      </Button>
      {onCancel && <Button variant="outline" isDisabled={add.isPending} onPress={onCancel}>Отмена</Button>}
    </div>
  </CardContent></Card>
}
