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

const priceOrder = offer => {
  if (!hasComparablePrice(offer)) return [1, '', 0]
  const value = amount(offer.price)
  return value == null ? [1, '', 0] : [0, `${offer.currency} ${offer.priceUnit}`.toUpperCase(), value]
}

/** Priced offers first, cheapest first within one currency and unit.
 *
 * Within a currency only: 140 CNY is not cheaper than 20 USD, and sorting
 * across currencies would rank them as if it were.
 */
export function sortByPrice(offers = []) {
  return [...offers].sort((left, right) => {
    const [a, b] = [priceOrder(left), priceOrder(right)]
    return (a[0] - b[0]) || a[1].localeCompare(b[1]) || (a[2] - b[2])
  })
}

/** "CIP Москва": the Incoterm and its place, as the supplier wrote them. */
export const offerBasis = offer => [offer.incoterm, offer.namedPlace].filter(present).join(' ')

/** What the columns have no room for: the minimum order and the payment. */
export const offerNote = offer => [
  present(offer.moq) && `MOQ ${offer.moq}`,
  present(offer.paymentTerms) && offer.paymentTerms,
].filter(Boolean).join('; ')

const answersThread = (offer, thread) =>
  (offer.negotiationId && offer.negotiationId === thread.assignmentId)
  || (offer.supplierId && offer.supplierId === thread.supplierId)

/** One substance's suppliers: who sent an offer, and who has not yet.
 *
 * An offer keeps the conversation it came from, so its row can open it; a
 * conversation without an offer is listed once, those waiting for a person
 * first — they are the only ones somebody has to act on.
 */
export function splitSuppliers(offers = [], threads = []) {
  const offered = sortByPrice(offers).map(offer => ({
    offer,
    thread: threads.find(thread => answersThread(offer, thread)) || null,
  }))
  const silent = threads
    .filter(thread => !offers.some(offer => answersThread(offer, thread)))
    .sort((left, right) => Number(Boolean(right.awaitingPerson)) - Number(Boolean(left.awaitingPerson)))
  return { offered, silent }
}

/** "18 ждём поставщика · 4 в очереди": how the silent ones stand, largest first. */
export function statusTally(threads = [], labelOf) {
  const counts = new Map()
  for (const thread of threads) {
    const label = labelOf(thread)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => `${count} ${label}`)
    .join(' · ')
}

/** Every conversation of a substance with the offer it brought, if any:
 * those waiting for a person first, then those with an offer.
 */
export function threadsWithOffers(offers = [], threads = []) {
  return threads
    .map(thread => ({ thread, offer: sortByPrice(offers).find(offer => answersThread(offer, thread)) || null }))
    .sort((left, right) => (Number(Boolean(right.thread.awaitingPerson)) - Number(Boolean(left.thread.awaitingPerson)))
      || (Number(Boolean(right.offer)) - Number(Boolean(left.offer))))
}
