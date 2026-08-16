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
  durationIsReliable,
  durationWidth,
  formatDuration,
  monthLabel,
  niceTicks,
  percent,
  share,
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

/** Median duration per transition. */
export function CycleTimeChart({ data }) {
  const transitions = data?.transitions || []
  const longest = Math.max(1, ...transitions.map(item => item.medianDays || 0))
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
                  aria-label={`${item.label}: ${shown.value} ${shown.unit || ''}`.trim()}
                >
                  {!shown.empty && (
                    <div
                      className="pr-funnel__bar"
                      data-weak={reliable ? undefined : 'true'}
                      style={{ width: `${durationWidth(item.medianDays, longest, true)}%` }}
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
            Кандидатов ещё нет. Запустите поиск поставщиков из карточки закупки.
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

/** Manufacturer vs intermediary, among confirmed candidates only. */
export function RoleChart({ data }) {
  const roles = data?.roles || { rows: [], verifiedTotal: 0 }
  const rows = (roles.rows || []).filter(row => row.count > 0)
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
          <>
            <div className="pr-funnel">
              {rows.map(row => (
                <div className="pr-funnel__row" key={row.role}>
                  <div className="pr-funnel__label">{row.label}</div>
                  <div
                    className="pr-funnel__track"
                    role="img"
                    aria-label={`${row.label}: ${row.count} из ${roles.verifiedTotal}`}
                  >
                    <div
                      className="pr-funnel__bar"
                      data-muted={row.role === 'UNKNOWN' ? 'true' : undefined}
                      style={{ width: `${share(row.count, roles.verifiedTotal)}%` }}
                    />
                  </div>
                  <span className="pr-funnel__value">
                    <b>{row.count}</b>
                    <span>из {roles.verifiedTotal}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="pr-chart-note">
              Доля подтверждённых производителей: <b>{percent(roles.manufacturerShare)}</b>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Where the confirmed supply base sits. */
export function GeographyChart({ data }) {
  const geography = data?.geography || { rows: [], unknown: 0, total: 0 }
  const widest = Math.max(1, ...geography.rows.map(row => row.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle>География поставщиков</CardTitle>
        <p className="pr-muted">
          Столбики, а не карта: при таком числе стран карта показывает меньше и
          занимает вчетверо больше места.
        </p>
      </CardHeader>
      <CardContent>
        {geography.total === 0 ? (
          <p className="pr-funnel__foot">В справочнике ещё нет поставщиков.</p>
        ) : (
          <>
            <div className="pr-funnel">
              {geography.rows.map(row => (
                <div className="pr-funnel__row" key={row.country}>
                  <div className="pr-funnel__label">{row.country}</div>
                  <div
                    className="pr-funnel__track"
                    role="img"
                    aria-label={`${row.country}: ${row.count}`}
                  >
                    <div
                      className="pr-funnel__bar"
                      data-muted={row.unknown ? 'true' : undefined}
                      style={{ width: `${share(row.count, widest)}%` }}
                    />
                  </div>
                  <span className="pr-funnel__value"><b>{row.count}</b></span>
                </div>
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
  }))
  const config = {
    failures: { label: 'Сбои доставки', color: 'var(--chart-2)' },
    quarantine: { label: 'Карантин неопознанных', color: 'var(--chart-3)' },
  }
  const peak = Math.max(...series.map(p => Math.max(p.failures, p.quarantine)), 0)
  const ticks = niceTicks(peak)
  const quiet = data?.totals && !data.totals.failures && !data.totals.quarantine

  return (
    <Card>
      <CardHeader>
        <CardTitle>Здоровье каналов и очередь агента</CardTitle>
        <p className="pr-muted">
          Отвечает на вопрос «работает ли агент прямо сейчас» без чтения логов
          контейнера.
        </p>
      </CardHeader>
      <CardContent>
        <div className="pr-channel__now">
          {[
            ['Застряло', data?.now?.stuck, 'ESCALATED или последняя ошибка воркера'],
            ['Ждут поставщика', data?.now?.waiting, 'отправлено, ответа нет'],
            ['Карантин открыт', data?.now?.unresolvedQuarantine, 'отправитель не опознан'],
          ].map(([label, value, hint]) => (
            <div className="pr-channel__stat" key={label} data-alarm={value > 0 ? 'true' : undefined}>
              <strong>{value ?? '—'}</strong>
              <span>{label}</span>
              <small>{hint}</small>
            </div>
          ))}
        </div>

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
