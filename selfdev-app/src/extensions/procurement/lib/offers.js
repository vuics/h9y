/** Offers read per substance: how many, how many with a price, and the prices.
 *
 * The prices are given as a range, not as a "best" offer: the comparison does
 * not rank suppliers, and a cheaper price with no documents or the wrong grade
 * is not the better offer. Which one is, the specialist decides.
 */

const present = value => value != null && String(value).trim() !== '' && String(value).toLowerCase() !== 'null'

export const hasComparablePrice = offer =>
  present(offer.price) && present(offer.currency) && present(offer.priceUnit)

const amount = value => {
  const number = Number(String(value).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

const trimNumber = value => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4))))

/** "831.51–1200 USD/KG", one span per currency and unit, most offers first. */
export function priceRanges(offers) {
  const spans = new Map()
  for (const offer of offers) {
    if (!hasComparablePrice(offer)) continue
    const value = amount(offer.price)
    if (value == null) continue
    const key = `${offer.currency} ${offer.priceUnit}`.toUpperCase()
    const span = spans.get(key) || { currency: offer.currency, unit: offer.priceUnit, min: value, max: value, count: 0 }
    span.min = Math.min(span.min, value)
    span.max = Math.max(span.max, value)
    span.count += 1
    spans.set(key, span)
  }
  return [...spans.values()]
    .sort((left, right) => right.count - left.count)
    .map(span => `${span.min === span.max ? trimNumber(span.min) : `${trimNumber(span.min)}–${trimNumber(span.max)}`} ${span.currency}/${span.unit}`)
}

export function groupOffersBySubstance(offers = []) {
  const groups = new Map()
  for (const offer of offers) {
    const cardId = offer.cardId || 0
    const group = groups.get(cardId) || {
      cardId,
      title: offer.cardTitle || (cardId ? `Карточка #${cardId}` : 'Без карточки'),
      cas: offer.cardCas || '',
      offers: [],
    }
    group.offers.push(offer)
    groups.set(cardId, group)
  }
  return [...groups.values()]
    .map(group => ({
      ...group,
      priced: group.offers.filter(hasComparablePrice).length,
      complete: group.offers.filter(offer => offer.completeness === 'COMPLETE').length,
      prices: priceRanges(group.offers),
      latest: group.offers.reduce((latest, offer) => (offer.updatedAt > latest ? offer.updatedAt : latest), ''),
    }))
    .sort((left, right) => (right.priced - left.priced) || String(right.latest).localeCompare(String(left.latest)))
}
