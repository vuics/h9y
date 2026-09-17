/** A supplier's price as the buyer should read it.
 *
 * The extractor sometimes finds the amount but not the currency or the unit —
 * a reply that says "3998.4" under a table header the model did not keep. The
 * old template printed those gaps as "null/null", which reads as a broken
 * page. A missing currency is still worth saying out loud, though: an amount
 * without one cannot be compared with anything, and hiding that would make the
 * cell look as good as a complete price next to it.
 */
const present = value => value != null && String(value).trim() !== '' && String(value).toLowerCase() !== 'null'

export function formatPrice({ price, currency, priceUnit } = {}) {
  if (!present(price)) return null
  const unit = present(priceUnit) ? `/${priceUnit}` : ''
  if (!present(currency)) return `${price}${unit} · валюта не указана`
  return `${price} ${currency}${unit}`
}
