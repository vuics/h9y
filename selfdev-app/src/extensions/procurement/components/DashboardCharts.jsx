/** The wave-2 charts, kept out of the page so each stays readable.
 *
 * Every one of them answers a question a head of sourcing asks out loud, and
 * every one carries the denominator behind its number: the recurring failure of
 * procurement dashboards is a confident percentage over four cases.
 */

import React from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { CircleAlert } from './icons'
import {
  axisInterval,
  dayLabel,
  decimal,
  durationIsReliable,
  durationWidth,
  foldTail,
  formatDuration,
  monthLabel,
  niceTicks,
  percent,
  plural,
  share,
  stackSegments,
  trafficLightSummary,
  worstFirst,
} from '../lib/dashboard'

/** Why one bar is the whole chart. Spelled out per colour, because "all yellow"
 *  and "all red" mean opposite things and a generic sentence would say neither. */
const SINGLE_COLOUR_NOTES = {
  GREEN:
    'Каждый найденный кандидат прошёл полный гейт: продукт и производственная роль '
    + 'подтверждены официальным источником, есть независимое подтверждение и нет рисков. '
    + 'Это редкий случай — стоит выборочно перепроверить вручную.',
  YELLOW:
    'Ни один кандидат не набрал на зелёный и ни один не попал в красный. Зелёный требует '
    + 'подтверждения продукта и производственной роли на официальном источнике плюс '
    + 'независимого подтверждения; жёлтый — это «доказательств пока недостаточно», '
    + 'а не «что-то не так». Работа гейта, а не сбой отрисовки.',
  RED:
    'У каждого кандидата найден риск: несоответствие продукта, негативный сигнал '
    + 'регулятора или противоречия между источниками. Проверьте запрос — возможно, '
    + 'ищется не то вещество.',
}

const STATUS_COLORS = {
  GREEN: 'var(--pr-good, #0ca30c)',
  YELLOW: 'var(--pr-warn, #fab219)',
  RED: 'var(--pr-bad, #d03b3b)',
}

/** Median duration per transition.
 *
 * `reference` is the customer's own figure for one of these steps, declared by
 * hand. It is drawn as a mark on the track rather than as a second bar, because
 * it is not a measurement of the same thing: their number is what a specialist
 * lives with today, ours is what the agent did in this period. Two solid bars
 * would read as one experiment run twice.
 */
export function CycleTimeChart({ data, reference }) {
  const transitions = data?.transitions || []
  // The reference joins the scale rather than sitting outside it: a seven-day
  // benchmark over a half-day median would otherwise be drawn past the end of
  // the track, or clipped to the end and read as a tie.
  const longest = Math.max(
    1,
    ...transitions.map(item => item.medianDays || 0),
    reference?.days || 0,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Куда уходит время</CardTitle>
        <p className="pr-muted">
          Медиана, а не среднее: один поставщик, ответивший через месяц, утащил бы
          среднее за пределы того, что специалист узнаёт как типичный срок.
        </p>
      </CardHeader>
      <CardContent>
        <div className="pr-funnel">
          {transitions.map(item => {
            const shown = formatDuration(item.medianDays, item.medianHours)
            const reliable = durationIsReliable(item.sample)
            const mark = reference?.key === item.key ? reference : null
            return (
              <div className="pr-funnel__row" key={item.key}>
                <div className="pr-funnel__label">
                  {item.label}
                  <small>
                    {item.sample === 0
                      ? 'нет пар с обеими отметками времени'
                      : `по ${item.sample} кейсам${reliable ? '' : ' — мало, чтобы читать как срок'}`}
                  </small>
                </div>
                <div
                  className="pr-funnel__track"
                  role="img"
                  aria-label={
                    `${item.label}: ${shown.value} ${shown.unit || ''}`.trim()
                    + (mark ? `, эталон заказчика ${decimal(mark.days)} дн.` : '')
                  }
                >
                  {!shown.empty && (
                    <div
                      className="pr-funnel__bar"
                      data-weak={reliable ? undefined : 'true'}
                      style={{ width: `${durationWidth(item.medianDays, longest, true)}%` }}
                    />
                  )}
                  {mark && (
                    <i
                      className="pr-funnel__mark"
                      style={{ left: `${durationWidth(mark.days, longest, true)}%` }}
                      title={`Эталон заказчика: ${decimal(mark.days)} дн., введён вручную`}
                    />
                  )}
                </div>
                <span className="pr-funnel__value">
                  <b>{shown.value}</b>
                  {shown.unit && <span>{shown.unit}</span>}
                </span>
              </div>
            )
          })}
        </div>
        {reference && (
          <p className="pr-chart-note">
            Штрих на шкале — срок, названный заказчиком: <b>{decimal(reference.days)} дн.</b>{' '}
            Введён вручную и ничем в системе не измеряется; сравнивается со
            средним случаем за период, а не с лучшим.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** How long a supplier makes us wait before the first word. */
export function FirstReplyChart({ data }) {
  const reply = data?.firstReply || { buckets: [], measured: 0, silent: 0 }
  const chartData = (reply.buckets || []).map(bucket => ({
    label: bucket.label,
    count: bucket.count,
  }))
  const config = { count: { label: 'Ответов', color: 'var(--chart-1)' } }
  const ticks = niceTicks(Math.max(...chartData.map(item => item.count), 0))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Через сколько отвечает поставщик</CardTitle>
        <p className="pr-muted">
          Проверяет решение, принятое после демо: работает ли короткое первое письмо.
        </p>
      </CardHeader>
      <CardContent>
        {reply.measured === 0 ? (
          <p className="pr-funnel__foot">
            Ни на одно отправленное письмо ответа пока нет — распределение появится
            с первым.
          </p>
        ) : (
          <>
            <ChartContainer config={config} className="tw:aspect-[16/7] tw:w-full">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                  domain={[0, ticks[ticks.length - 1]]}
                  ticks={ticks}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={72}
                />
              </BarChart>
            </ChartContainer>
            <p className="pr-chart-note">
              Измерено по <b>{reply.measured}</b> ответам
              {reply.silent > 0 && <> · <b>{reply.silent}</b> заданий ждут ответа</>}
            </p>
            <p className="pr-chart-note">{reply.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Traffic light, split by whether a person confirmed the score. */
export function TrafficLightChart({ data }) {
  const rows = data?.trafficLight || []
  const summary = trafficLightSummary(rows)
  const widest = Math.max(1, ...rows.map(row => row.total))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Светофор базы поставщиков</CardTitle>
        <p className="pr-muted">
          Серое — подтверждения специалиста ещё нет. Это очередь работы, а не
          достижение: автоматическая оценка никогда не равна проверке.
        </p>
      </CardHeader>
      <CardContent>
        {summary.total === 0 ? (
          <p className="pr-funnel__foot">
            Кандидатов ещё нет. Запустите поиск поставщиков из карточки позиции.
          </p>
        ) : (
          <>
            {rows.map(row => (
              <div className="pr-variant-row" key={row.status}>
                <div className="pr-variant-row__name">
                  {row.label}
                  <small>всего {row.total}</small>
                </div>
                <div className="pr-variant-bars">
                  <div className="pr-variant-bar">
                    <div
                      className="pr-variant-bar__track"
                      role="img"
                      aria-label={`${row.label}: подтверждено ${row.confirmed}, без проверки ${row.unreviewed}`}
                    >
                      <div className="pr-split-bar">
                        <i
                          style={{
                            width: `${share(row.confirmed, widest)}%`,
                            background: STATUS_COLORS[row.status],
                          }}
                        />
                        <i
                          className="pr-split-bar__pending"
                          style={{
                            width: `${share(row.unreviewed, widest)}%`,
                            // Hatched in the row's own status colour: same
                            // status, not yet confirmed. Filled flat it would be
                            // indistinguishable from the empty track, and the
                            // gap between the two segments is the entire point.
                            '--pending-color': STATUS_COLORS[row.status],
                          }}
                        />
                      </div>
                    </div>
                    <span className="pr-variant-bar__value">
                      <b>{row.confirmed}</b>
                      <span>+{row.unreviewed}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {summary.single && (
              <Alert>
                <CircleAlert />
                <AlertTitle>Все кандидаты в одном цвете</AlertTitle>
                <AlertDescription>
                  {SINGLE_COLOUR_NOTES[summary.single.status]}
                </AlertDescription>
              </Alert>
            )}
            <p className="pr-chart-note">
              Ждут решения специалиста: <b>{summary.unreviewed}</b> из {summary.total}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Role colours, the same here and in the monthly trend beside it. */
const ROLE_COLORS = {
  MANUFACTURER: 'var(--chart-1)',
  BOTH: 'var(--chart-3)',
  DISTRIBUTOR: 'var(--chart-2)',
  UNKNOWN: 'var(--chart-track)',
}

/** Manufacturer vs intermediary, among confirmed candidates only.
 *
 * One bar split to 100%, not a row per role: the roles are parts of one whole,
 * and four rows each drawn against the total looked four times emptier than
 * the base is. A pie would say the same with less precise angles.
 */
export function RoleChart({ data }) {
  const roles = data?.roles || { rows: [], verifiedTotal: 0 }
  const segments = stackSegments((roles.rows || []).map(row => ({ ...row, stage: row.role })))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Производители и посредники</CardTitle>
        <p className="pr-muted">{roles.note}</p>
      </CardHeader>
      <CardContent>
        {roles.verifiedTotal === 0 ? (
          <p className="pr-funnel__foot">
            Ни один кандидат ещё не подтверждён специалистом — подтверждать роль пока не у кого.
          </p>
        ) : (
          <div className="pr-portfolio">
            <div className="pr-role__headline">
              <b>{percent(roles.manufacturerShare)}</b>
              <span>подтверждённых — производители</span>
            </div>
            <div
              className="pr-stackbar pr-stackbar--tall"
              role="img"
              aria-label={segments.map(row => `${row.label}: ${row.count} из ${roles.verifiedTotal}`).join(', ')}
            >
              {segments.map(row => (
                <i
                  key={row.role}
                  title={`${row.label}: ${row.count}`}
                  data-muted={row.role === 'UNKNOWN' ? 'true' : undefined}
                  style={{ width: `${row.share}%`, background: ROLE_COLORS[row.role] }}
                />
              ))}
            </div>
            <ul className="pr-role__legend">
              {segments.map(row => (
                <li key={row.role}>
                  <i style={{ background: ROLE_COLORS[row.role] }} data-muted={row.role === 'UNKNOWN' ? 'true' : undefined} />
                  <span>{row.label}</span>
                  <b>{row.count}</b>
                  <small>{percent(row.count / roles.verifiedTotal)}</small>
                </li>
              ))}
            </ul>
            <p className="pr-chart-note">Всего подтверждено специалистом: {roles.verifiedTotal}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** How many countries the card lists before folding the tail into one line. */
const GEOGRAPHY_LEADERS = 7

function GeographyRow({ row, widest }) {
  return (
    <div className="pr-funnel__row">
      <div className="pr-funnel__label">{row.country}</div>
      <div className="pr-funnel__track" role="img" aria-label={`${row.country}: ${row.count}`}>
        <div
          className="pr-funnel__bar"
          data-muted={row.unknown ? 'true' : undefined}
          style={{ width: `${share(row.count, widest)}%` }}
        />
      </div>
      <span className="pr-funnel__value"><b>{row.count}</b></span>
    </div>
  )
}

/** Where the supply base sits.
 *
 * The leaders and one folded line, so the card sits level with its neighbours:
 * the long tail is one or two suppliers a country and reads better as a count
 * than as twenty slivers. A map was considered and left out — with one country
 * holding most of the base it shows one dark shape and a pale world.
 */
export function GeographyChart({ data }) {
  const [expanded, setExpanded] = React.useState(false)
  const geography = data?.geography || { rows: [], unknown: 0, total: 0 }
  const widest = Math.max(1, ...geography.rows.map(row => row.count))
  const folded = foldTail(geography.rows, GEOGRAPHY_LEADERS)
  const countries = geography.countries ?? geography.rows.filter(row => !row.unknown).length
  return (
    <Card>
      <CardHeader>
        <CardTitle>География поставщиков</CardTitle>
        <p className="pr-muted">
          {countries} {plural(countries, 'страна', 'страны', 'стран')}, {geography.total}{' '}
          {plural(geography.total, 'поставщик', 'поставщика', 'поставщиков')} в справочнике.
        </p>
      </CardHeader>
      <CardContent>
        {geography.total === 0 ? (
          <p className="pr-funnel__foot">В справочнике ещё нет поставщиков.</p>
        ) : (
          <>
            <div className="pr-funnel">
              {folded.shown.filter(row => !row.unknown).map(row => (
                <GeographyRow key={row.country} row={row} widest={widest} />
              ))}
              {expanded && folded.hidden.map(row => (
                <GeographyRow key={row.country} row={row} widest={widest} />
              ))}
              {folded.rest && (
                <button
                  type="button"
                  className="pr-geo__more"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(value => !value)}
                >
                  {expanded
                    ? 'Свернуть'
                    : `Ещё ${folded.rest.places} ${plural(folded.rest.places, 'страна', 'страны', 'стран')} · ${folded.rest.count} ${plural(folded.rest.count, 'поставщик', 'поставщика', 'поставщиков')}`}
                </button>
              )}
              {folded.shown.filter(row => row.unknown).map(row => (
                <GeographyRow key={row.country} row={row} widest={widest} />
              ))}
            </div>
            {geography.unknown > 0 && (
              <p className="pr-chart-note">
                У <b>{geography.unknown}</b> из {geography.total} поставщиков страна не
                заполнена — это пробел в данных, а не место на карте.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** What the prices came out at.
 *
 * Three numbers a buyer recognises: how much cheaper the best offer is than a
 * typical one, how many positions had a real market check, and what the
 * supplier's second word did to their first. Comparable offers only — the
 * server never converts currencies, so a position without a common basis has
 * no spread rather than an invented one.
 */
export function PriceOutcomeChart({ data }) {
  const spread = data?.spread || {}
  const negotiation = data?.negotiation || {}
  const priced = data?.pricedCards || 0
  const size = data?.marketCheckSize || 3
  return (
    <Card>
      <CardHeader>
        <CardTitle>Цены в предложениях</CardTitle>
        <p className="pr-muted">Что получилось по цене, а не по переписке.</p>
      </CardHeader>
      <CardContent>
        {priced === 0 ? (
          <p className="pr-funnel__foot">Предложений с ценой ещё нет.</p>
        ) : (
          <div className="pr-verdict pr-verdict--three">
            <div className="pr-verdict__tile">
              <span>Лучшая цена ниже медианной</span>
              <b>{spread.median == null ? '—' : percent(spread.median)}</b>
              <small>
                {spread.sample
                  ? `медиана по ${spread.sample} ${plural(spread.sample, 'позиции', 'позициям', 'позициям')} с двумя и больше сопоставимыми ценами`
                  : 'нет позиций с двумя сопоставимыми ценами'}
              </small>
            </div>
            <div className="pr-verdict__tile">
              <span>Рыночная проверка: {size}+ сопоставимых цены</span>
              <b>{data.marketChecked} <small>из {priced}</small></b>
              <div className="pr-portfolio__progress" role="img" aria-label={`${data.marketChecked} из ${priced}`}>
                <i style={{ width: `${share(data.marketChecked, priced)}%`, background: 'var(--chart-1)' }} />
              </div>
              <small>позиций с ценой; две и больше — у {data.comparedCards}</small>
            </div>
            <div className="pr-verdict__tile" data-improved={negotiation.lowered ? 'true' : undefined}>
              <span>Переговоры по цене</span>
              <b>{negotiation.medianChange == null ? '—' : `${negotiation.medianChange < 0 ? '−' : '+'}${percent(Math.abs(negotiation.medianChange))}`}</b>
              <small>
                {negotiation.revised
                  ? `цена пересмотрена в ${negotiation.revised} ${plural(negotiation.revised, 'предложении', 'предложениях', 'предложениях')}, снижена в ${negotiation.lowered}`
                  : 'пересмотров цены пока не было'}
              </small>
            </div>
          </div>
        )}
        {data?.note && <p className="pr-chart-note">{data.note}</p>}
      </CardContent>
    </Card>
  )
}

/** Which conditions suppliers systematically leave out. */
export function OfferGapsChart({ data }) {
  const rows = worstFirst(data?.rows || [])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Чего не хватает в предложениях</CardTitle>
        <p className="pr-muted">{data?.note}</p>
      </CardHeader>
      <CardContent>
        {!data?.total ? (
          <p className="pr-funnel__foot">
            Разобранных ответов поставщиков ещё нет.
          </p>
        ) : (
          <>
            <div className="pr-funnel">
              {rows.map(row => (
                <div className="pr-funnel__row" key={row.field}>
                  <div className="pr-funnel__label">
                    {row.label}
                    {row.isDocument && <small>документ</small>}
                  </div>
                  <div
                    className="pr-funnel__track"
                    role="img"
                    aria-label={`${row.label}: указано в ${row.present} из ${row.of} ответов`}
                  >
                    <div
                      className="pr-funnel__bar"
                      data-muted={row.isDocument ? 'true' : undefined}
                      style={{ width: `${share(row.present, row.of)}%` }}
                    />
                  </div>
                  <span className="pr-funnel__value">
                    <b>{percent(row.share)}</b>
                    <span>{row.present} из {row.of}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="pr-chart-note">
              Разобрано ответов: <b>{data.total}</b>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Daily volume rows, one per series, stacked on a shared date axis.
 *
 * Separate rows rather than one chart: sends run in the hundreds and
 * escalations in the dozens, and on a shared scale the smaller series would be
 * a line along zero. The shared axis keeps the sequence visible — a wave of
 * sending, then the replies, then the escalations they raise.
 */
const VOLUME_ROWS = [
  ['sent', 'Отправлено', 'var(--chart-1)'],
  ['received', 'Получено', 'var(--chart-3)'],
  ['escalations', 'Эскалации', 'var(--chart-2)'],
]

function VolumeRow({ series, dataKey, label, color, total, last }) {
  const peak = Math.max(0, ...series.map(point => point[dataKey] || 0))
  const config = { [dataKey]: { label, color } }
  return (
    <div className="pr-volume__row">
      <div className="pr-volume__label">
        <span>{label}</span>
        <b>{total ?? 0}</b>
        <small>макс. {peak} в день</small>
      </div>
      <ChartContainer config={config} className="pr-volume__chart" style={{ height: last ? 74 : 54 }}>
        <BarChart data={series} margin={{ top: 4, right: 16, bottom: 0, left: 16 }} barCategoryGap={1}>
          <XAxis
            dataKey="label"
            hide={!last}
            tickLine={false}
            axisLine={false}
            interval={axisInterval(series.length)}
            tick={{ fontSize: 11 }}
          />
          <YAxis hide domain={[0, Math.max(1, peak)]} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

/** Is the agent working right now, and what is stuck.
 *
 * Two series and three counters, kept visibly apart. Failures and quarantine are
 * timestamped events and plot as a daily line; "stuck" is a current state with
 * no recorded history, so it sits beside the chart as a number rather than being
 * drawn as a trend nobody measured.
 */
export function ChannelHealthChart({ data }) {
  const series = (data?.series || []).map(point => ({
    label: dayLabel(point.day),
    failures: point.failures,
    quarantine: point.quarantine,
    sent: point.sent || 0,
    received: point.received || 0,
    escalations: point.escalations || 0,
  }))
  const config = {
    failures: { label: 'Сбои доставки', color: 'var(--chart-2)' },
    quarantine: { label: 'Карантин неопознанных', color: 'var(--chart-3)' },
  }
  const peak = Math.max(...series.map(p => Math.max(p.failures, p.quarantine)), 0)
  const ticks = niceTicks(peak)
  const quiet = data?.totals && !data.totals.failures && !data.totals.quarantine
  const volumeRows = VOLUME_ROWS.filter(([key]) => key !== 'escalations' || data?.escalationsAvailable !== false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Каналы и очередь агента</CardTitle>
        <p className="pr-muted">
          Работает ли агент прямо сейчас и сколько через него проходит — без
          чтения логов контейнера.
        </p>
      </CardHeader>
      <CardContent>
        <div className="pr-channel__now">
          {[
            ['Застряло', data?.now?.stuck, 'ESCALATED или последняя ошибка воркера', true],
            ['Ждут поставщика', data?.now?.waiting, 'отправлено, ответа нет', false],
            ['Карантин открыт', data?.now?.unresolvedQuarantine, 'отправитель не опознан', true],
          ].map(([label, value, hint, alarming]) => (
            // Only states that need a person turn red: waiting for suppliers
            // is the normal condition of outreach, not an alarm.
            <div className="pr-channel__stat" key={label} data-alarm={alarming && value > 0 ? 'true' : undefined}>
              <strong>{value ?? '—'}</strong>
              <span>{label}</span>
              <small>{hint}</small>
            </div>
          ))}
        </div>

        {series.length > 0 && (
          <div className="pr-volume">
            {volumeRows.map(([key, label, color], index) => (
              <VolumeRow
                key={key}
                series={series}
                dataKey={key}
                label={label}
                color={color}
                total={data?.totals?.[key]}
                last={index === volumeRows.length - 1}
              />
            ))}
          </div>
        )}
        {data?.volumeNote && <p className="pr-chart-note">{data.volumeNote}</p>}

        <h4 className="pr-volume__heading">Сбои доставки и карантин</h4>
        {series.length > 0 && (
          <ChartContainer config={config} className="tw:aspect-[16/6] tw:w-full">
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={axisInterval(series.length)}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
                domain={[0, ticks[ticks.length - 1]]}
                ticks={ticks}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {/* Straight segments, not a spline: a monotone curve through
                  0, 0, 16, 0, 0 bulges above zero on the days either side, and
                  those days had no incidents at all. Counts do not interpolate. */}
              <Line
                type="linear" dataKey="failures" stroke="var(--color-failures)"
                strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              />
              <Line
                type="linear" dataKey="quarantine" stroke="var(--color-quarantine)"
                strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}

        {quiet && (
          <p className="pr-chart-note">
            За период ни одного сбоя доставки и ни одного неопознанного сообщения.
            Для этого графика пустой ряд — это и есть ответ.
          </p>
        )}
        <p className="pr-chart-note">
          За период: сбоев <b>{data?.totals?.failures ?? 0}</b>, в карантин попало{' '}
          <b>{data?.totals?.quarantine ?? 0}</b>
        </p>
        <p className="pr-chart-note">{data?.seriesNote}</p>
      </CardContent>
    </Card>
  )
}

/** Manufacturer share over time.
 *
 * The snapshot beside it answers "what do we have"; this answers "is the sorting
 * getting better", which is the question behind the customer's stated pain.
 */
export function RoleTrendChart({ data }) {
  const rows = (data?.roleTrend?.rows || []).map(row => ({
    label: monthLabel(row.month),
    MANUFACTURER: row.MANUFACTURER,
    BOTH: row.BOTH,
    DISTRIBUTOR: row.DISTRIBUTOR,
    UNKNOWN: row.UNKNOWN,
    share: row.manufacturerShare,
    total: row.total,
  }))
  const config = {
    MANUFACTURER: { label: 'Производитель', color: 'var(--chart-1)' },
    BOTH: { label: 'Производитель и дистрибьютор', color: 'var(--chart-3)' },
    DISTRIBUTOR: { label: 'Дистрибьютор', color: 'var(--chart-2)' },
    UNKNOWN: { label: 'Роль не установлена', color: 'var(--chart-track)' },
  }
  const ticks = niceTicks(Math.max(...rows.map(r => r.total), 0))
  const measured = rows.filter(row => row.total > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доля производителей по месяцам</CardTitle>
        <p className="pr-muted">{data?.roleTrend?.note}</p>
      </CardHeader>
      <CardContent>
        {measured.length === 0 ? (
          <p className="pr-funnel__foot">
            Подтверждённых кандидатов пока нет ни в одном месяце — тренд появится
            после первых решений специалиста.
          </p>
        ) : (
          <>
            <ChartContainer config={config} className="tw:aspect-[16/7] tw:w-full">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                  domain={[0, ticks[ticks.length - 1]]}
                  ticks={ticks}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {['MANUFACTURER', 'BOTH', 'DISTRIBUTOR', 'UNKNOWN'].map((key, index, all) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="roles"
                    fill={`var(--color-${key})`}
                    radius={index === all.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={72}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <p className="pr-chart-note">
              Последний месяц с решениями: доля производителей{' '}
              <b>{percent(measured[measured.length - 1].share)}</b> из{' '}
              {measured[measured.length - 1].total} подтверждённых
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
