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
