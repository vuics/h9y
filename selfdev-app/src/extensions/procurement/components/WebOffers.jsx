import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { priceStrip, webOfferRows } from '../lib/memberSteps'
import { ExternalLink } from './icons'

const AVAILABILITY = { IN_STOCK: 'в наличии', ON_ORDER: 'под заказ', OUT_OF_STOCK: 'нет в наличии' }

const money = (value, currency) => `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency === 'RUB' ? '₽' : currency || ''}`.trim()

export const webOfferPrice = offer => (offer.amount != null ? money(offer.amount, offer.currency) : 'цена не указана')

export const webOfferUnitPrice = offer =>
  (offer.unitPrice != null ? `${money(offer.unitPrice, offer.currency)}/${offer.unit}` : null)

export const webOfferStock = offer => AVAILABILITY[offer.availability] || null

/** Each price a point on one log scale: an odd one is seen before it is believed.
 * The table below holds the same prices for whoever does not read the strip. */
function PriceStrip({ rows }) {
  const strip = priceStrip(rows)
  if (!strip) return null
  const perUnit = value => `${money(value, strip.currency)}/${strip.unit}`
  return <figure className="pr-price-strip" aria-label={`Распределение цен: от ${perUnit(strip.min)} до ${perUnit(strip.max)}, медиана ${perUnit(strip.median)}`}>
    <span className="pr-price-strip__end">{perUnit(strip.min)}</span>
    <div className="pr-price-strip__track">
      <i className="pr-price-strip__median" style={{ left: `${strip.medianAt}%` }}><span>медиана {perUnit(strip.median)}</span></i>
      {strip.points.map(point => <a
        key={`${point.candidateId}-${point.id}`}
        className="pr-price-strip__point"
        style={{ left: `${point.at}%` }}
        href={point.url || undefined}
        target="_blank"
        rel="noreferrer"
        title={`${point.seller}: ${perUnit(point.unitPrice)}${point.pack ? `, ${webOfferPrice(point)} за ${point.pack}` : ''}`}
        aria-label={`${point.seller}: ${perUnit(point.unitPrice)}`}
      />)}
    </div>
    <span className="pr-price-strip__end">{perUnit(strip.max)}</span>
  </figure>
}

/** Prices a position's candidates publish on their sites. Read when opened: the
 * search it comes from is the heaviest thing a position has.
 *
 * From `runId`, the search the campaign counts them in, when there is one: the
 * card's latest is a search started again and still running, and it showed
 * "Цены с сайтов (9)" over an empty list until it finished. */
export function WebOffers({ cardId, runId = null }) {
  const query = useQuery({
    queryKey: runId ? procurementKeys.sourcingRun(runId) : procurementKeys.sourcing(cardId),
    queryFn: ({ signal }) => (runId
      ? procurementApi.sourcingRun(runId, signal)
      : procurementApi.sourcing(cardId, signal)),
  })
  const rows = webOfferRows(query.data)
  if (query.isLoading) return <p className="pr-note">Загружаем цены с сайтов…</p>
  if (!rows.length) return null
  return <div className="pr-member-offers pr-web-offers">
    <p className="pr-note">Как опубликовано на странице; это не коммерческое предложение, наличие и цену подтвердит поставщик.</p>
    <PriceStrip rows={rows} />
    <div className="pr-table-wrap"><table className="pr-table pr-member-offers__table">
      <thead><tr><th>Продавец</th><th>Цена</th><th>Фасовка</th><th>За единицу</th><th>Чистота</th><th>Бренд</th><th>Наличие</th></tr></thead>
      <tbody>{rows.map(offer => <tr key={`${offer.candidateId}-${offer.id}`}>
        <td>{offer.seller}</td>
        <td className="pr-member-offers__price">
          {offer.url
            ? <a href={offer.url} target="_blank" rel="noreferrer" title={offer.quote}>{webOfferPrice(offer)} <ExternalLink size={12} /></a>
            : webOfferPrice(offer)}
        </td>
        <td>{offer.pack || '—'}</td>
        <td>{webOfferUnitPrice(offer) || '—'}</td>
        <td>{offer.purity || '—'}</td>
        <td>{offer.brand || '—'}</td>
        <td>{webOfferStock(offer) || '—'}</td>
      </tr>)}</tbody>
    </table></div>
  </div>
}
