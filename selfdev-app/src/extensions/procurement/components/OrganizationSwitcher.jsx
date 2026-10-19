import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { selectOrganization } from '../lib/organization'

/** The organization this workspace shows, and the switch for a person in several.
 *
 * Switching reloads rather than refetching in place: every cached list, the
 * capability check and the permissions belong to the organization they were
 * read in, and a page that mixed two would be worse than a reload. It reloads
 * the workspace home, not the current address: a campaign or a card open in
 * one organization does not exist in the next, and reopening it there would
 * greet the person with "not found".
 */
export function OrganizationSwitcher() {
  const { organizationsEnabled, organization } = useProcurementPermissions()
  const organizations = useQuery({
    queryKey: procurementKeys.organizations(),
    queryFn: ({ signal }) => procurementApi.organizations(signal),
    enabled: organizationsEnabled,
    staleTime: 60000,
  })
  if (!organizationsEnabled) return null
  const choices = organizations.data?.organizations || []
  const current = organizations.data?.current || organization
  if (choices.length < 2) {
    return current
      ? <span className="pr-organization" title="Организация">{current.name}</span>
      : <span className="pr-organization pr-organization--none">Нет организации</span>
  }
  return <label className="pr-organization">
    <span className="pr-sr-only">Организация</span>
    <select
      value={current?.id || ''}
      onChange={event => {
        selectOrganization(event.target.value)
        window.location.assign('/procurement')
      }}
    >
      {!current && <option value="">— выберите организацию —</option>}
      {choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>
}
