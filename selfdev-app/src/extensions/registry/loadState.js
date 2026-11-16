/**
 * Load what the build knows (manifests) and what the API reports (capabilities)
 * as two separate facts.
 *
 * Manifests ship with the build, so a slow or failed capability request must
 * not take them away. When it did, an unanswered `/extensions` left no manifest
 * and the workspace told a signed-in buyer «Эта сборка приложения не включает
 * раздел закупок» instead of retrying.
 */
export async function loadExtensionState({ manifestLoaders, fetchCapabilities }) {
  const manifests = {}
  await Promise.all(Object.entries(manifestLoaders).map(async ([id, loader]) => {
    manifests[id] = (await loader()).default
  }))
  try {
    return { manifests, capabilities: await fetchCapabilities(), error: null }
  } catch (error) {
    return { manifests, capabilities: null, error }
  }
}
