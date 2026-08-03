import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import conf from '../../conf'
import { useIndexContext } from '../../components/IndexContext'
import { evaluateExtensionActivation } from './activation'

const buildIncludesProcurement = import.meta.env.VITE_BUILD_PROCUREMENT === 'true'
const extensionLoaders = buildIncludesProcurement
  ? { procurement: () => import('../procurement/index.js') }
  : {}
const manifestLoaders = buildIncludesProcurement
  ? { procurement: () => import('../procurement/manifest.js') }
  : {}
const useDevFixtures = import.meta.env.DEV &&
  import.meta.env.VITE_PROCUREMENT_DEV_FIXTURES === 'true'
const developmentCapabilitiesLoader = import.meta.env.DEV
  ? () => import('./devCapabilities')
  : null

const ExtensionContext = createContext({
  loading: true,
  navigation: [],
  getExtension: () => null,
})

export const useExtensions = () => useContext(ExtensionContext)

export function ExtensionProvider({ children }) {
  const { user, authChecked } = useIndexContext()
  const [capabilities, setCapabilities] = useState(null)
  const [manifests, setManifests] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!authChecked || !user?.email) {
        setCapabilities(null)
        setManifests({})
        setLoading(!authChecked)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const loadedManifests = {}
        await Promise.all(Object.entries(manifestLoaders).map(async ([id, loader]) => {
          loadedManifests[id] = (await loader()).default
        }))
        const response = useDevFixtures && developmentCapabilitiesLoader
          ? (await developmentCapabilitiesLoader()).developmentCapabilities
          : (await axios.get(`${conf.api.url}/extensions`, {
            withCredentials: true,
            timeout: 10000,
          })).data
        if (!cancelled) {
          setManifests(loadedManifests)
          setCapabilities(response)
        }
      } catch (requestError) {
        if (!cancelled) {
          setCapabilities(null)
          setError(requestError)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authChecked, user?.email])

  const extensions = useMemo(() => {
    const capabilityMap = new Map(
      (capabilities?.extensions || []).map(item => [item.id, item]),
    )
    const ids = new Set([...Object.keys(manifests), ...capabilityMap.keys(), 'procurement'])
    return Object.fromEntries([...ids].map(id => {
      const manifest = manifests[id]
      const capability = capabilityMap.get(id)
      return [id, {
        id,
        manifest,
        capability,
        activation: evaluateExtensionActivation({
          buildAvailable: Boolean(extensionLoaders[id] && manifest),
          capability,
          requiredPermissions: manifest?.requiredPermissions,
        }),
        loader: extensionLoaders[id],
        capabilitiesError: error,
      }]
    }))
  }, [capabilities, manifests, error])

  const navigation = useMemo(() => Object.values(extensions)
    .filter(extension => extension.activation.active)
    .flatMap(extension => extension.manifest?.navigation || []), [extensions])
  const value = useMemo(() => ({
    loading,
    navigation,
    getExtension: id => extensions[id] || null,
    usingDevelopmentFixtures: useDevFixtures,
  }), [extensions, loading, navigation])

  return <ExtensionContext.Provider value={value}>{children}</ExtensionContext.Provider>
}
