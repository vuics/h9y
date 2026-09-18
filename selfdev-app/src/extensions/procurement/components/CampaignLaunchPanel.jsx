import React, { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import {
  SourcingSettings,
  canLaunch,
  defaultSourcingValue,
  plural,
  sourcesPerSubstance,
  sourcingValueFromPlan,
  useSourcingSettings,
} from './SourcingSettings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Search } from './icons'

/** Launch one run over many substances.
 *
 * The reach control is a ladder rather than a row of independent checkboxes
 * because the steps depend on each other: there is nobody to write to before
 * contacts are collected, and no request to send before an RFQ is approved.
 * Independent switches would let an operator ask for a state the system cannot
 * reach and would have to silently ignore — and a setting that is silently
 * ignored is worse than one that is missing.
 */

const REACH_STEPS = [
  {
    id: 'SOURCING',
    label: 'Только найти поставщиков',
    detail: 'Открытый поиск и предварительная оценка по каждому веществу. Ничего наружу не уходит.',
  },
  {
    id: 'CONTACTS',
    label: '+ собрать контакты',
    detail: 'Дочитать сайты найденных компаний и карточки в каталогах, чтобы было куда писать.',
  },
  {
    id: 'OUTREACH',
    label: '+ разослать запросы и начать переговоры',
    detail: 'Останавливается на одном экране согласования: кому пишем и что спрашиваем.',
  },
  {
    id: 'NEGOTIATION',
    label: '+ вести переговоры до сравнимых предложений',
    detail: 'Агент ведёт переписку сам. Закупочных решений он не принимает: где нужно суждение — эскалация специалисту.',
  },
]

const CHANNELS = [
  ['EMAIL', 'Email'],
  ['WHATSAPP', 'WhatsApp'],
  ['ECHEMI', 'Echemi'],
  ['WEB_FORM', 'Формы на сайтах'],
]

const mutationMessage = error => error?.response?.data?.message || error?.message

// A launch that timed out on the way back may still have created the campaign.
// Looked for by the file it came from, and only among campaigns started since
// the press, so an older run from the same file is never mistaken for it.
const LAUNCH_CLOCK_SKEW_MS = 60_000

async function findLaunched(importId, startedAt) {
  if (!importId) return null
  try {
    const { items = [] } = await procurementApi.campaigns()
    return items.find(item => item.importId === importId
      && Date.parse(item.createdAt) >= startedAt - LAUNCH_CLOCK_SKEW_MS) || null
  } catch {
    return null
  }
}

export function CampaignLaunchPanel({
  cardIds = [],
  importId,
  substanceName,
  cas,
  canEdit,
  onLaunched,
  onCancel,
  // An existing campaign: the panel edits its plan instead of launching one.
  campaign,
  onSaved,
}) {
  const editing = Boolean(campaign)
  const plan = campaign?.plan
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const settings = useSourcingSettings()
  // Set before the request leaves, not after React re-renders: a second press
  // in the same frame still sees `isPending` false and would launch again.
  const inFlight = useRef(false)
  const [sourcing, setSourcing] = useState(() => defaultSourcingValue({ campaign: true }))
  const [reach, setReach] = useState(plan?.reach || 'OUTREACH')
  const [channels, setChannels] = useState(plan?.channels || ['EMAIL', 'WHATSAPP', 'ECHEMI', 'WEB_FORM'])
  const [approveRfq, setApproveRfq] = useState(plan?.approveRfq ?? true)
  const [draftFirst, setDraftFirst] = useState(plan?.draftFirst ?? false)
  const [confirmCandidates, setConfirmCandidates] = useState(plan?.confirmCandidates ?? true)
  // The stored plan's search settings can only be read once the query and
  // engine lists have loaded; seeded then, once.
  const seeded = useRef(false)
  useEffect(() => {
    if (!editing || seeded.current || settings.isLoading) return
    seeded.current = true
    setSourcing(sourcingValueFromPlan(plan, settings))
  }, [editing, plan, settings])

  // The plan as the API takes it, for a launch and for a change alike.
  const planPayload = () => ({
    reach,
    channels,
    approveRfq,
    draftFirst,
    confirmCandidates,
    // Depth is chosen as results-per-query; the API takes the analysis
    // budget, which is that spread back over the queries it will issue.
    maxResults: sourcesPerSubstance(
      sourcing.depth,
      (sourcing.queryIds ?? settings.defaultQueryIds).length,
      settings.maxAnalysedSources,
    ),
    siteProbe: sourcing.siteProbe,
    ...(sourcing.queryIds ?? settings.defaultQueryIds).length
      ? { queryTemplateIds: sourcing.queryIds ?? settings.defaultQueryIds }
      : {},
    ...(sourcing.engineIds ?? settings.availableEngineIds).length
      ? { engineIds: sourcing.engineIds ?? settings.availableEngineIds }
      : {},
  })

  const start = useMutation({
    mutationFn: () => {
      const startedAt = Date.now()
      if (editing) return procurementApi.changeCampaignSettings(campaign.campaignId, planPayload())
      return procurementApi.startCampaign({
        cardIds,
        ...(importId ? { importId } : {}),
        ...planPayload(),
      }).catch(async error => {
        // A refusal is a refusal; only a lost answer may hide a launch.
        const status = error?.response?.status
        if (status && status < 500) throw error
        const launched = await findLaunched(importId, startedAt)
        if (launched) return launched
        throw error
      })
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
      if (editing) {
        onSaved?.(result)
        return
      }
      onLaunched?.(result)
      navigate(`/procurement/campaigns/${result.campaignId}`)
    },
    onSettled: (_result, error) => {
      // Released only on failure when launching: after a success the page is
      // leaving, and a button that comes back to life for that moment invites
      // a second press. Settings stay on the page, so they are released.
      if (error || editing) inFlight.current = false
    },
  })

  const launch = () => {
    if (inFlight.current) return
    inFlight.current = true
    start.mutate()
  }
  const busy = start.isPending || (!editing && start.isSuccess)

  const sendsAnything = reach !== 'SOURCING' && reach !== 'CONTACTS'
  const ready = (editing || cardIds.length > 0) && canLaunch(settings, sourcing) && (!sendsAnything || channels.length > 0)

  const members = campaign?.members || []
  const notSearched = members.filter(member => member.stage === 'QUEUED').length
  const waiting = members.filter(member => member.stage === 'AWAITING_REVIEW').length

  return <Card className="pr-sourcing-launch"><CardHeader><div>
    {editing
      ? <>
        <CardTitle>Настройки кампании</CardTitle>
        <p>Изменения действуют на то, что ещё впереди; сделанное не переделывается. Поиск — для {notSearched} {plural(notSearched, 'вещества', 'веществ', 'веществ')}, которые ещё не искали. Снятая проверка сразу применится и к {waiting} {plural(waiting, 'веществу', 'веществам', 'веществам')}, ждущим согласования. Более далёкая ступень «Довести до» продолжит остановленные вещества с их готовым поиском.</p>
      </>
      : <>
        <CardTitle>Запуск по {cardIds.length} {plural(cardIds.length, 'веществу', 'веществам', 'веществам')}</CardTitle>
        <p>Те же настройки, что и у поиска по одной карточке — результат можно сравнивать с исследованными вручную.</p>
      </>}
  </div></CardHeader><CardContent>
    {start.error && <Alert><AlertTriangle /><AlertTitle>Запуск не выполнен</AlertTitle><AlertDescription>{mutationMessage(start.error)}</AlertDescription></Alert>}

    <fieldset className="pr-reach-ladder">
      <legend>Довести до</legend>
      {REACH_STEPS.map(step => <label key={step.id} className={reach === step.id ? 'is-selected' : undefined}>
        <input
          type="radio"
          name="campaign-reach"
          checked={reach === step.id}
          disabled={start.isPending}
          onChange={() => setReach(step.id)}
        />
        <span><strong>{step.label}</strong>{step.detail}</span>
      </label>)}
    </fieldset>

    {sendsAnything && <>
      <fieldset className="pr-campaign-channels">
        <legend>Куда отправлять запросы</legend>
        {CHANNELS.map(([id, label]) => <label key={id}>
          <input
            type="checkbox"
            checked={channels.includes(id)}
            disabled={start.isPending}
            onChange={event => setChannels(current => event.target.checked
              ? [...new Set([...current, id])]
              : current.filter(value => value !== id))}
          />
          <span>{label}</span>
        </label>)}
        {!channels.length && <p className="pr-note">Выберите хотя бы один канал — иначе запросу некуда уйти.</p>}
      </fieldset>

      <fieldset className="pr-campaign-approval">
        <legend>Где спрашивать</legend>
        <label>
          <input type="checkbox" checked={confirmCandidates} disabled={start.isPending} onChange={event => setConfirmCandidates(event.target.checked)} />
          <span><strong>Проверять найденных поставщиков перед рассылкой</strong>Вы подтверждаете каждую найденную компанию как производителя или дистрибьютора. Если снять — агент сам примет роль, к которой пришли доказательства; компании с неясной ролью он не трогает и не пишет им.</span>
        </label>
        <label>
          <input type="checkbox" checked={approveRfq} disabled={start.isPending} onChange={event => setApproveRfq(event.target.checked)} />
          <span><strong>Согласовать RFQ перед первой отправкой</strong>Один экран на всю кампанию: кому пишем и что спрашиваем. Это согласование покрывает всю рассылку, включая заявки на площадках.</span>
        </label>
        <label>
          <input type="checkbox" checked={draftFirst} disabled={start.isPending} onChange={event => setDraftFirst(event.target.checked)} />
          <span><strong>Показывать каждое письмо до отправки</strong>Сверх согласования RFQ. На большой кампании это возвращает работу по письму за письмом — включайте, когда переписка идёт с новой площадкой.</span>
        </label>
      </fieldset>
      {!confirmCandidates && !approveRfq && !draftFirst && <p className="pr-note">Все проверки сняты: кампания сама пройдёт от поиска до отправленных запросов. Вы увидите результат на странице кампании; компании с неясной ролью останутся на согласовании.</p>}
    </>}

    <SourcingSettings
      settings={settings}
      value={sourcing}
      onChange={setSourcing}
      disabled={start.isPending}
      canEdit={canEdit}
      cas={cas}
      substanceName={substanceName}
      substanceCount={editing ? Math.max(1, notSearched) : cardIds.length}
    />

    <div className="pr-sourcing-launch__controls">
      <Button isDisabled={!ready || busy} onPress={launch}>
        <Search className={busy ? 'pr-spin' : undefined} />
        {editing
          ? (start.isPending ? 'Сохраняем…' : 'Сохранить настройки')
          : start.isSuccess ? 'Запущено, открываем кампанию…' : start.isPending ? 'Запускаем…' : `Запустить по ${cardIds.length}`}
      </Button>
      {onCancel && <Button variant="outline" isDisabled={busy} onPress={onCancel}>Отмена</Button>}
    </div>
    <p className="pr-note">Ошибка по одному веществу не останавливает остальные: она записывается в строку этого вещества, а кампания едет дальше.</p>
  </CardContent></Card>
}
