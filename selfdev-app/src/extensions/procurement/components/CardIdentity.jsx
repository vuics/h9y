import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'

// Which substance a screen is about. Both proposal screens are reached with a
// card id in the URL and then talk only about suppliers and figures, so the
// one thing a reader needs to know — what is being bought — was missing from
// the page and had to be carried in from wherever they came.
export function CardIdentity({ cardId }) {
  const query = useQuery({
    queryKey: procurementKeys.card(cardId),
    queryFn: ({ signal }) => procurementApi.card(cardId, signal),
    enabled: Boolean(cardId),
    staleTime: 5 * 60 * 1000,
  })
  if (!cardId) return null
  const card = query.data
  const name = card?.substanceName || card?.title
  return <p className="pr-card-identity">
    <Link to={`/procurement/requests/${cardId}`}>Карточка #{cardId}</Link>
    {name && <><span aria-hidden="true"> · </span><strong>{name}</strong></>}
    {card?.casNumber && <><span aria-hidden="true"> · </span><span>CAS {card.casNumber}</span></>}
    {card?.targetVolume && <><span aria-hidden="true"> · </span><span>{card.targetVolume}</span></>}
  </p>
}
