import React, { Suspense, useEffect, useState } from 'react'

import { useExtensions } from './ExtensionContext'

const stateCopy = {
  'build-unavailable': ['Workspace unavailable', 'Procurement is not included in this frontend distribution.'],
  'runtime-unavailable': ['Unable to verify Procurement access', 'The capabilities endpoint did not return a Procurement capability.'],
  disabled: ['Procurement is disabled', 'This installation has not enabled the Procurement workspace.'],
  incompatible: ['Incompatible extension version', 'The frontend and backend Procurement extension API versions do not match.'],
  'permission-denied': ['Access denied', 'Your account does not have the required Procurement permissions.'],
}

function RouteState({ state, loading }) {
  const [title, message] = loading
    ? ['Checking access…', 'Loading installation capabilities.']
    : stateCopy[state] || ['Procurement unavailable', 'Please try again later.']
  return <main style={{ maxWidth: 720, margin: '12vh auto', padding: 24 }}><h1>{title}</h1><p>{message}</p></main>
}

export default function ExtensionRoute({ id }) {
  const { loading, getExtension } = useExtensions()
  const extension = getExtension(id)
  const activationActive = extension?.activation.active
  const loader = extension?.loader
  const [module, setModule] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!activationActive || !loader) return undefined
    loader()
      .then(loaded => { if (!cancelled) setModule(loaded) })
      .catch(requestError => { if (!cancelled) setLoadError(requestError) })
    return () => { cancelled = true }
  }, [activationActive, loader])

  if (loading) return <RouteState loading />
  if (!extension?.activation.active) return <RouteState state={extension?.activation.state} />
  if (loadError) throw loadError
  if (!module?.ProcurementWorkspace) return <RouteState loading />
  const Workspace = module.ProcurementWorkspace
  return <Suspense fallback={<RouteState loading />}><Workspace extensionState={extension} /></Suspense>
}
