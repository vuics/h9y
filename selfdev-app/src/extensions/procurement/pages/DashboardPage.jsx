/** The manager's screen: how the department is doing, not what to do next.
 *
 * Deliberately separate from «Обзор». That screen is a worklist a specialist
 * acts on today; this one answers a question a head of sourcing asks about the
 * last month. Merging them would push the escalation queue below the fold and
 * answer neither question well.
 *
 * Three rules are carried through every chart here, because they are what makes
 * the numbers usable rather than decorative:
 *   1. a share is never shown without the denominator it came from;
 *   2. a rate below the server's reliability threshold is shown, but visibly
 *      marked as unreadable rather than hidden or rounded into confidence;
 *   3. every figure links into the list of rows that produced it.
 */

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import {
  barWidth,
  cohortIsEmpty,
  decimal,
  describeStep,
  niceTicks,
  percent,
  rateScale,
  windowParams,
} from '../lib/dashboard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { CircleAlert, Clock } from '../components/icons'
import {
  CycleTimeChart,
  FirstReplyChart,
  GeographyChart,
  OfferGapsChart,
  RoleChart,
  TrafficLightChart,
} from '../components/DashboardCharts'
import { BenchmarkChart } from '../components/BenchmarkChart'
import { DashboardCsvButton, ExportableCard } from '../components/ChartExport'

const PERIODS = [
  ['7', '7 дней'],
  ['30', '30 дней'],
  ['90', '90 дней'],
]

const BUCKET_COLORS = {
  UNDER_1D: 'var(--chart-ordinal-1)',
  D1_D3: 'var(--chart-ordinal-2)',
  D3_D7: 'var(--chart-ordinal-3)',
  OVER_7D: 'var(--chart-ordinal-4)',
}

/** One funnel stage.
 *
 * Drawn as a row with its own track rather than as a Recharts bar, because the
 * track carries the stage above it — "84 of 88" is the whole point, and a
 * shared axis would flatten every late stage into an unreadable sliver.
 */
function FunnelRow({ step, entry }) {
  const width = barWidth(step.count, entry)
  const described = describeStep(step)
  const value = (
    <span className="pr-funnel__value">
      <b>{described.value}</b>
      {described.of && <span>{described.of}</span>}
    </span>
  )
  return (
    <div className="pr-funnel__row">
      <div className="pr-funnel__label">
        {step.href ? <Link to={step.href}>{step.label}</Link> : step.label}
        {step.note && <small>{step.note}</small>}
      </div>
      <div
        className="pr-funnel__track"
        role="img"
        aria-label={`${step.label}: ${step.count}${step.of != null ? ` из ${step.of}` : ''}`}
      >
        <div className="pr-funnel__bar" style={{ width: `${width}%` }} />
      </div>
      {value}
    </div>
  )
}

function Funnel({ cohort }) {
  const entry = cohort.steps[0]?.count || 0
  return (
    <div className="pr-funnel">
      {cohort.steps.map(step => (
        <FunnelRow key={step.key} step={step} entry={entry} />
      ))}
    </div>
  )
}

function FunnelCard({ params, days, onDays }) {
  const query = useQuery({
    queryKey: procurementKeys.analyticsFunnel(params),
    queryFn: ({ signal }) => procurementApi.analyticsFunnel(params, signal),
  })

  if (query.isLoading) return <LoadingState rows={8} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const data = query.data
  const discoveryEmpty = cohortIsEmpty(data.discovery)
  const outreachEmpty = cohortIsEmpty(data.outreach)

  return (
    <ExportableCard title="Воронка закупочного цикла">
    <Card>
      <CardHeader>
        <CardTitle>Воронка закупочного цикла</CardTitle>
        <p className="pr-muted">
          Сквозная конверсия от найденного кандидата до сопоставимого предложения.
          Это та конверсия первичных и повторных запросов в квоты, которую требует ТЗ.
        </p>
        <div className="pr-inline-actions">
          {PERIODS.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={days === value ? 'secondary' : 'outline'}
              onPress={() => onDays(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.discovery?.available === false ? (
          <Alert>
            <CircleAlert />
            <AlertTitle>Контур поиска не подключён</AlertTitle>
            <AlertDescription>
              В этой установке нет прогонов открытого поиска, поэтому первая половина
              воронки не считается. Это не ноль найденных кандидатов.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <h3>{data.discovery.label}</h3>
            <p className="pr-dash__seam">Вход: {data.discovery.entry}</p>
            {discoveryEmpty
              ? <p className="pr-funnel__foot">За период не было ни одного прогона поиска. Запустите поиск из карточки закупки, чтобы здесь появились кандидаты.</p>
              : <Funnel cohort={data.discovery} />}
          </>
        )}

        <h3 style={{ marginTop: 22 }}>{data.outreach.label}</h3>
        <p className="pr-dash__seam">Вход: {data.outreach.entry}</p>
        {outreachEmpty
          ? <p className="pr-funnel__foot">За период не создано ни одного задания на переговоры.</p>
          : <Funnel cohort={data.outreach} />}

        <p className="pr-funnel__foot">{data.seam}</p>
        <p className="pr-funnel__foot">{data.cohortNote}</p>
        {data.truncated && (
          <Alert>
            <CircleAlert />
            <AlertTitle>Показана часть данных</AlertTitle>
            <AlertDescription>
              За период больше записей, чем сканирует один расчёт. Сузьте период,
              чтобы числа были точными.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
    </ExportableCard>
  )
}

/** Conversion per wording.
 *
 * Bars rather than the existing table because the comparison is the point, and
 * a rate under `minSample` is hatched rather than dropped: hiding it would
 * suggest the wording was never tried.
 */
function VariantCard() {
  const query = useQuery({
    queryKey: procurementKeys.variantPerformance({ stage: 'FIRST_CONTACT' }),
    queryFn: ({ signal }) => procurementApi.variantPerformance({ stage: 'FIRST_CONTACT' }, signal),
  })

  if (query.isLoading) return <LoadingState rows={5} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const rows = query.data?.rows || []
  const minSample = query.data?.minSample ?? 12
  const scale = rateScale(rows)

  return (
    <ExportableCard title="Что отвечают на первое письмо">
    <Card>
      <CardHeader>
        <CardTitle>Что отвечают на первое письмо</CardTitle>
        <p className="pr-muted">
          Доля ответов и доля дошедших до котировки по каждой формулировке первого
          обращения. {query.data?.attributionNote}
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="pr-funnel__foot">
            Отправленных первых писем ещё нет. Строки появятся, когда агент напишет
            первому поставщику.
          </p>
        ) : (
          <>
            {rows.map(row => (
              <div className="pr-variant-row" key={`${row.itemId}-${row.variantId || 'base'}`}>
                <div className="pr-variant-row__name">
                  <Link to={`/procurement/communication/playbook/${row.itemId}`}>{row.itemTitle}</Link>
                  <small>
                    {row.variantLabel} · отправлено {row.sent}
                    {!row.reliable && ` · выборка меньше ${minSample}`}
                  </small>
                </div>
                <div className="pr-variant-bars">
                  {[
                    ['replied', row.replied, row.replyRate],
                    ['quoted', row.quoted, row.quoteRate],
                  ].map(([series, count, rate]) => (
                    <div className="pr-variant-bar" key={series}>
                      <div
                        className="pr-variant-bar__track"
                        role="img"
                        aria-label={`${series === 'replied' ? 'Ответили' : 'Дошли до котировки'}: ${count} из ${row.sent}`}
                      >
                        <div
                          className="pr-variant-bar__fill"
                          data-series={series}
                          data-weak={row.reliable ? undefined : 'true'}
                          style={{ width: `${Math.min(100, ((rate || 0) / scale) * 100)}%` }}
                        />
                      </div>
                      <span className="pr-variant-bar__value">
                        <b>{percent(rate)}</b>
                        <span>({count}/{row.sent})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="pr-chart-legend">
              <span><i style={{ background: 'var(--chart-1)' }} />Доля ответивших</span>
              <span><i style={{ background: 'var(--chart-3)' }} />Доля давших котировку</span>
              <span><i style={{ background: 'var(--chart-track)', outline: '1px solid var(--pr-border)' }} />Мало данных</span>
            </div>
            {!rows.some(row => row.reliable) && (
              <Alert>
                <CircleAlert />
                <AlertTitle>Разницу читать рано</AlertTitle>
                <AlertDescription>
                  Ни одна формулировка не набрала {minSample} отправленных сообщений.
                  На таком объёме различие между ними — шум.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
    </ExportableCard>
  )
}

/** Open escalations by category and age.
 *
 * Age is the dimension that obliges anyone to act, so it is the stack; a plain
 * count per category would say nothing about what is rotting.
 */
function BottlenecksCard() {
  const query = useQuery({
    queryKey: procurementKeys.analyticsBottlenecks(),
    queryFn: ({ signal }) => procurementApi.analyticsBottlenecks(signal),
  })

  if (query.isLoading) return <LoadingState rows={5} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const data = query.data
  const chartData = (data.rows || []).map(row => ({
    label: row.label,
    ...row.buckets,
  }))
  const ticks = niceTicks(Math.max(...(data.rows || []).map(row => row.total), 0))
  const config = Object.fromEntries(
    (data.buckets || []).map(bucket => [
      bucket.key,
      { label: bucket.label, color: BUCKET_COLORS[bucket.key] },
    ])
  )

  return (
    <ExportableCard title="Эскалации по возрасту и причине">
    <Card>
      <CardHeader>
        <CardTitle>Эскалации по возрасту и причине</CardTitle>
        <p className="pr-muted">
          Возраст — то измерение, которое обязывает действовать; количество само по
          себе не обязывает. Причины упорядочены по внутреннему весу риска, а не по
          численности.
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="pr-funnel__foot">
            Открытых эскалаций нет. Кейс попадает сюда автоматически, когда разбор
            ответа поставщика упирается в решение человека.
          </p>
        ) : (
          <>
            <ChartContainer config={config} className="tw:aspect-[16/7] tw:w-full">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                  // Recharts' default picks a round tick count, so a queue of one
                  // case gets an axis to four and the bar reads as negligible.
                  domain={[0, ticks[ticks.length - 1]]}
                  ticks={ticks}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {(data.buckets || []).map((bucket, index, all) => (
                  <Bar
                    key={bucket.key}
                    dataKey={bucket.key}
                    stackId="age"
                    fill={`var(--color-${bucket.key})`}
                    // A 2px surface gap between segments, and rounded ends only
                    // on the top of the stack.
                    radius={index === all.length - 1 ? [4, 4, 0, 0] : 0}
                    // Without a cap, a queue holding one category stretches that
                    // bar across the whole plot: a single slab that reads as a
                    // rendering fault rather than as one open case.
                    maxBarSize={72}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <p className="pr-chart-note">
              <Clock size={12} /> Всего открытых: <b>{data.total}</b>
              {data.oldestDays > 0 && ` · самая старая ждёт ${decimal(data.oldestDays)} дн.`}
              {data.undated > 0 && ` · без даты создания: ${data.undated}`}
            </p>
            <div className="pr-inline-actions">
              <Link to="/procurement/escalations?status=OPEN">Открыть очередь эскалаций</Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </ExportableCard>
  )
}

/** Timing, supply base and offer quality.
 *
 * One query per question rather than one per chart: the two timing charts read
 * the same cohort, and splitting them would make the page ask the server for the
 * same rows twice and then disagree with itself at the boundary of a minute.
 */
function TimingSection({ params }) {
  const query = useQuery({
    queryKey: procurementKeys.analyticsCycleTime(params),
    queryFn: ({ signal }) => procurementApi.analyticsCycleTime(params, signal),
  })
  if (query.isLoading) return <LoadingState rows={5} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  return (
    <div className="pr-dash__grid">
      <ExportableCard title="Куда уходит время"><CycleTimeChart data={query.data} /></ExportableCard>
      <ExportableCard title="Через сколько отвечает поставщик"><FirstReplyChart data={query.data} /></ExportableCard>
    </div>
  )
}

/** The comparison the pilot is judged on. */
function BenchmarkSection({ params, canEdit }) {
  const query = useQuery({
    queryKey: procurementKeys.analyticsBenchmark(params),
    queryFn: ({ signal }) => procurementApi.analyticsBenchmark(params, signal),
  })
  if (query.isLoading) return <LoadingState rows={6} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  return (
    <ExportableCard title="Человек и агент">
      <BenchmarkChart data={query.data} canEdit={canEdit} />
    </ExportableCard>
  )
}

function SupplyBaseSection() {
  const query = useQuery({
    queryKey: procurementKeys.analyticsSupplyBase(),
    queryFn: ({ signal }) => procurementApi.analyticsSupplyBase(signal),
  })
  if (query.isLoading) return <LoadingState rows={5} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  return (
    <div className="pr-dash__grid pr-dash__grid--three">
      <ExportableCard title="Светофор базы поставщиков"><TrafficLightChart data={query.data} /></ExportableCard>
      <ExportableCard title="Производители и посредники"><RoleChart data={query.data} /></ExportableCard>
      <ExportableCard title="География поставщиков"><GeographyChart data={query.data} /></ExportableCard>
    </div>
  )
}

function OfferQualitySection() {
  const query = useQuery({
    queryKey: procurementKeys.analyticsOfferQuality(),
    queryFn: ({ signal }) => procurementApi.analyticsOfferQuality(signal),
  })
  if (query.isLoading) return <LoadingState rows={5} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  return (
    <ExportableCard title="Чего не хватает в предложениях">
      <OfferGapsChart data={query.data} />
    </ExportableCard>
  )
}

export default function DashboardPage() {
  const [days, setDays] = useState('30')
  // Computed once per period and handed down. Recomputing it inside the export
  // would stamp a fresh `new Date()` into the query key, miss the cache the
  // charts filled, and report the dashboard as empty.
  const params = useMemo(() => windowParams(days), [days])
  const {
    canReadEscalations,
    canReadCommunications,
    canReviewSourcing,
  } = useProcurementPermissions()

  return (
    <div className="pr-dash">
      <div className="pr-section-heading">
        <div>
          <h2>Как идут закупки</h2>
          <p>
            Сводная картина за период. Каждое число ведёт в список строк, из которых
            оно посчитано; доли показаны вместе со знаменателем.
          </p>
        </div>
        <DashboardCsvButton params={params} />
      </div>

      <FunnelCard params={params} days={days} onDays={setDays} />

      <div className="pr-dash__grid">
        {canReadCommunications && <VariantCard />}
        {canReadEscalations && <BottlenecksCard />}
      </div>

      <h3 className="pr-dash__section">Человек и агент</h3>
      <BenchmarkSection params={params} canEdit={canReviewSourcing} />

      <h3 className="pr-dash__section">Сроки</h3>
      <TimingSection params={params} />

      <h3 className="pr-dash__section">База поставщиков</h3>
      <SupplyBaseSection />

      <h3 className="pr-dash__section">Качество предложений</h3>
      <OfferQualitySection />
    </div>
  )
}
