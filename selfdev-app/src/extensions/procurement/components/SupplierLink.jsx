import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { ExternalLink } from './icons'
import { supplierLinkLabel } from '../lib/supplierWeb'

// Who this company actually is, reachable from the screens where their offer is
// being judged. The supplier card holds the website, but a proposal named the
// company in plain text and left no way through to it, so checking whether a
// quotation comes from a real business meant leaving the workspace and
// searching for the name by hand.
function useSupplierWebsite(supplierId) {
  const query = useQuery({
    queryKey: procurementKeys.supplier(supplierId),
    queryFn: ({ signal }) => procurementApi.supplier(supplierId, signal),
    enabled: Boolean(supplierId),
    staleTime: 5 * 60 * 1000,
  })
  // `procurementApi.supplier` wraps the record: the card itself is under
  // `data.supplier`, with negotiations and proposals beside it.
  return query.data?.supplier?.website || null
}

/** The supplier's own site, or nothing at all when we do not hold one.
 *
 * It carries its own separator so that a supplier without a website leaves no
 * dangling dot in the line it sits on.
 */
export function SupplierWebsite({ supplierId, separator = true }) {
  const website = useSupplierWebsite(supplierId)
  if (!website) return null
  return <>
    {separator && <span aria-hidden="true"> · </span>}
    <a href={website} target="_blank" rel="noreferrer" title={website}>
      <ExternalLink size={13} />{supplierLinkLabel(website)}
    </a>
  </>
}

/** The supplier by name, and their site when there is one. */
export function SupplierLink({ supplierId, name }) {
  if (!supplierId) return name ? <span>{name}</span> : null
  return <>
    <Link to={`/procurement/suppliers/${supplierId}`}>{name || supplierId}</Link>
    <SupplierWebsite supplierId={supplierId} />
  </>
}
