import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { webOfferRows } from '../lib/memberSteps'
import { ExternalLink } from './icons'

const AVAILABILITY = { IN_STOCK: 'в наличии', ON_ORDER: 'под заказ', OUT_OF_STOCK: 'нет в наличии' }

const money = (value, currency) => `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency === 'RUB' ? '₽' : currency || ''}`.trim()

export const webOfferPrice = offer => (offer.amount != null ? money(offer.amount, offer.currency) : 'цена не указана')

export const webOfferUnitPrice = offer =>
  (offer.unitPrice != null ? `${money(offer.unitPrice, offer.currency)}/${offer.unit}` : null)

export const webOfferStock = offer => AVAILABILITY[offer.availability] || null

/** Prices a position's candidates publish on their sites. Read when opened: the
 * search it comes from is the heaviest thing a position has. */
export function WebOffers({ cardId }) {
  const query = useQuery({
    queryKey: procurementKeys.sourcing(cardId),
    queryFn: ({ signal }) => procurementApi.sourcing(cardId, signal),
  })
  const rows = webOfferRows(query.data)
  if (query.isLoading) return <p className="pr-note">Загружаем цены с сайтов…</p>
  if (!rows.length) return null
  return <div className="pr-member-offers pr-web-offers">
    <p className="pr-note"><b>Цены с сайтов.</b> Как опубликовано на странице; это не коммерческое предложение, наличие и цену подтвердит поставщик.</p>
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
