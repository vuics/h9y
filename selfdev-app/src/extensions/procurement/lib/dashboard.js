/** Presentation rules for the dashboard, kept out of the component.
 *
 * These are the decisions that are easy to get subtly wrong and impossible to
 * see in a screenshot: a stage with a real count drawn as nothing, a share
 * rendered without the number it came from, or a period that quietly shifts.
 * Extracted so the tests exercise the same code the browser runs.
 */

/** The window a period button asks for. */
export function windowParams(days, now = new Date()) {
  const to = new Date(now.getTime())
  const from = new Date(to.getTime() - Number(days) * 86400000)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** How wide a funnel bar is drawn, as a percentage of the cohort's entry step.
 *
 * A non-zero count never renders as an empty track: a stage that really did
 * convert one supplier out of four hundred must still be visible, because "a
 * thin sliver" and "nothing happened" mean opposite things to a reader. Zero
 * stays zero for the same reason — it must not look like a rounding artefact.
 */
export function barWidth(count, entry) {
  if (!entry || !count) return 0
  return Math.max(1.5, Math.min(100, (count / entry) * 100))
}

/** A share, or an em dash — never a bare zero standing in for "unknown". */
export function percent(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

/** "17 из 50 · 34%", or just the count at the entry step where there is no
 *  denominator to divide by. */
export function describeStep(step) {
  if (step.of == null) return { value: String(step.count), of: null }
  return { value: String(step.count), of: `из ${step.of} · ${percent(step.conversion)}` }
}

/** Whether a cohort has anything to draw at all. */
export function cohortIsEmpty(cohort) {
  return !cohort?.steps?.length || !cohort.steps[0]?.count
}

/** The scale the variant bars share.
 *
 * Rates are scaled against the best one rather than against 100%, so a set of
 * realistic reply rates does not render as five identical stubs — but never
 * below a floor, or a single weak variant would be drawn as a full bar and read
 * as a success.
 */
export function rateScale(rows, floor = 0.5) {
  const best = rows.reduce(
    (max, row) => Math.max(max, row.replyRate || 0, row.quoteRate || 0),
    0,
  )
  return Math.max(floor, best)
}

/** A duration in the unit a reader can act on.
 *
 * A step that really takes forty minutes rounds to "0,0 дн." and reads as
 * instant — a far more flattering claim than the truth. Under a day the answer
 * is hours; `null` stays "нет данных", because no measurable cases and zero
 * elapsed time are different answers.
 */
export function formatDuration(days, hours) {
  if (days == null) return { value: 'нет данных', unit: null, empty: true }
  if (days < 1 && hours != null) {
    const minutes = Math.round(hours * 60)
    // Rounding down to a bare "0 мин" recreates, one unit lower, exactly the
    // "reads as instant" problem that hours were introduced to fix.
    if (minutes < 1) return { value: 'меньше минуты', unit: null, empty: false }
    return hours < 1
      ? { value: String(minutes), unit: 'мин', empty: false }
      : { value: decimal(hours), unit: 'ч', empty: false }
  }
  return { value: decimal(days), unit: 'дн', empty: false }
}

/** A decimal a Russian reader expects: comma, not point. */
export function decimal(value) {
  return value == null ? '—' : String(value).replace('.', ',')
}

/** Below this many measured cases a median is a coincidence, not a duration. */
export const MIN_DURATION_SAMPLE = 5

export function durationIsReliable(sample) {
  return sample >= MIN_DURATION_SAMPLE
}

/** Share of a whole, guarding the zero-denominator case that makes bars vanish. */
export function share(part, whole) {
  if (!whole) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
}

/** What the traffic light actually says, in one sentence.
 *
 * Worth stating outright: on a real base every candidate can sit in one colour,
 * and a reader who sees a single bar deserves to know that is the scoring gate
 * behaving, not a rendering fault.
 */
export function trafficLightSummary(rows) {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const occupied = rows.filter(row => row.total > 0)
  const unreviewed = rows.reduce((sum, row) => sum + row.unreviewed, 0)
  return {
    total,
    unreviewed,
    single: occupied.length === 1 ? occupied[0] : null,
  }
}

/** Fields ordered worst-first, for the "what is missing" chart.
 *
 * Presentation order only — the server's order is stable so periods can be
 * compared, but a reader opening this chart wants the gaps, not the schema.
 */
export function worstFirst(rows, limit = 0) {
  const sorted = [...rows].sort((a, b) => (a.share ?? 1) - (b.share ?? 1))
  return limit > 0 ? sorted.slice(0, limit) : sorted
}

/** The metrics a benchmark row can hold a declared value for.
 *
 * Mirrors the server's allow-list. Only labour hours are declarable on the
 * agent side; every other agent figure is measured, and offering a field for it
 * would invite someone to overwrite a measurement with a wish.
 */
export const BASELINE_FIELDS = [
  { key: 'HOURS_PER_CASE', label: 'Часов на кейс', unit: 'ч', agentDeclared: true },
  { key: 'CANDIDATES_FOUND', label: 'Найдено кандидатов', unit: '', agentDeclared: false },
  { key: 'VERIFIED_MANUFACTURERS', label: 'Подтверждённых производителей', unit: '', agentDeclared: false },
  { key: 'REQUESTS_SENT', label: 'Запросов отправлено', unit: '', agentDeclared: false },
  { key: 'REPLIES_RECEIVED', label: 'Ответов получено', unit: '', agentDeclared: false },
  { key: 'QUOTES_RECEIVED', label: 'Котировок получено', unit: '', agentDeclared: false },
]

/** Bar widths for one benchmark row.
 *
 * Each row is scaled to its own larger value, never to a shared axis: hours and
 * counts are different units, and one axis across them would be a dual-axis
 * chart wearing a disguise — it would invent a comparison that is not in the
 * data.
 */
export function benchmarkWidths(row) {
  const human = row.human?.value
  const agent = row.agent?.value
  const largest = Math.max(human ?? 0, agent ?? 0)
  if (!largest) return { human: 0, agent: 0 }
  return {
    human: human == null ? 0 : Math.max(1.5, (human / largest) * 100),
    agent: agent == null ? 0 : Math.max(1.5, (agent / largest) * 100),
  }
}

/** How a delta should read to someone scanning the column.
 *
 * Direction is not the same as improvement: fewer hours is better, fewer
 * replies is worse, and the arrow has to follow meaning rather than sign.
 */
export function describeDelta(row) {
  if (!row.delta || row.delta.improved == null) return null
  const { ratio, improved } = row.delta
  return {
    improved,
    arrow: improved ? '↑' : '↓',
    text: ratio ? `${String(ratio).replace('.', ',')}×` : null,
  }
}

/** Turn the stored metric map into the flat form the inputs bind to. */
export function baselineFormValues(rows) {
  const values = {}
  for (const field of BASELINE_FIELDS) {
    const row = rows.find(item => item.key === field.key)
    values[`HUMAN_${field.key}`] = row?.human?.value ?? ''
    if (field.agentDeclared) {
      values[`AGENT_${field.key}`] = row?.agent?.value ?? ''
    }
  }
  return values
}

/** Width of a measured-duration bar.
 *
 * A measured value always draws something. Thirty-six minutes beside a two-day
 * step is about one percent of the scale and renders as an empty track — which
 * is exactly how "no data" renders. Those two must never look the same, so a
 * measured value gets a visible floor and only an unmeasured one gets nothing.
 */
export function durationWidth(days, largest, measured) {
  if (!measured || !largest) return 0
  return Math.max(2, Math.min(100, ((days || 0) / largest) * 100))
}

/** Evenly spaced integer ticks up to a count.
 *
 * Left to itself Recharts appends the data maximum as its own tick, so an axis
 * over five cases reads 0, 2, 4, 5 — the last gap half the others, which makes
 * the top of the chart look mismeasured. Counts are integers, so the ticks are
 * too, and they are evenly spaced by construction.
 */
export function niceTicks(max) {
  const top = Math.max(1, Math.ceil(max || 0))
  if (top <= 5) return Array.from({ length: top + 1 }, (_, index) => index)
  const step = Math.ceil(top / 4)
  const ceiling = step * Math.ceil(top / step)
  const ticks = []
  for (let value = 0; value <= ceiling; value += step) ticks.push(value)
  return ticks
}

/** Short day label for a daily series: `2026-08-16` → `16.08`.
 *
 * The year is dropped because every point in a window shares it, and a
 * thirty-point axis of full dates is unreadable at any width.
 */
export function dayLabel(day) {
  const [, month, date] = String(day || '').split('-')
  return month && date ? `${date}.${month}` : String(day || '')
}

/** Show roughly this many labels on a daily axis, whatever the window length. */
export function axisInterval(pointCount, target = 8) {
  return pointCount <= target ? 0 : Math.ceil(pointCount / target) - 1
}

/** `2026-07` → `июль`. Month names are what a reader compares, not ISO keys. */
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export function monthLabel(month) {
  const [year, index] = String(month || '').split('-')
  const name = MONTHS[Number(index) - 1]
  return name ? `${name} ${String(year).slice(2)}` : String(month || '')
}

/** The four headline numbers, taken from payloads the charts already hold.
 *
 * Derived rather than fetched: a fifth request for numbers already on the page
 * would be a second source of truth and a chance for the tiles to disagree with
 * the charts under them.
 */
export function headlineTiles({ funnel, cycleTime, channelHealth, bottlenecks }) {
  const step = key => funnel?.outreach?.steps?.find(item => item.key === key)
  const complete = step('COMPLETE')
  const quote = cycleTime?.transitions?.find(item => item.key === 'REPLY_TO_QUOTE')
  return [
    {
      key: 'COMPLETE',
      label: 'Полных предложений',
      value: complete ? complete.count : null,
      hint: complete?.of == null ? null : `из ${complete.of} котировок`,
    },
    {
      key: 'TO_QUOTE',
      label: 'Ответ → котировка',
      value: quote?.medianDays ?? null,
      days: quote?.medianDays ?? null,
      hours: quote?.medianHours ?? null,
      hint: quote?.sample ? `медиана по ${quote.sample} кейсам` : 'нет измеримых кейсов',
    },
    {
      key: 'WAITING',
      label: 'Ждут поставщика',
      value: channelHealth?.now?.waiting ?? null,
      hint: 'заданий отправлено, ответа нет',
    },
    {
      key: 'ATTENTION',
      label: 'Требуют специалиста',
      value: bottlenecks?.total ?? null,
      hint: bottlenecks?.oldestDays ? `самая старая ждёт ${decimal(bottlenecks.oldestDays)} дн.` : null,
    },
  ]
}
