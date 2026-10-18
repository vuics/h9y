import React, { Suspense, useEffect, useState } from 'react'

import { useExtensions } from './ExtensionContext'
import { useIndexContext } from '../../components/IndexContext'

// In Russian, like the workspace behind it.
const stateCopy = {
  'build-unavailable': ['Раздел закупок недоступен', 'Эта сборка приложения не включает раздел закупок.'],
  disabled: ['Раздел закупок выключен', 'В этой установке раздел закупок не включён. Обратитесь к администратору.'],
  incompatible: ['Нужно обновить страницу', 'Версия приложения отличается от версии сервиса закупок. Обновите страницу; если не поможет — сообщите администратору.'],
}

// Not knowing is not a refusal: while the service restarts or does not answer,
// the page says so and keeps asking, and opens the workspace once it answers.
const RETRYING = new Set(['service-unavailable', 'runtime-unavailable'])
const RETRY_MS = 10000

function Shell({ title, children }) {
  return <main style={{ maxWidth: 720, margin: '12vh auto', padding: 24 }}><h1>{title}</h1>{children}</main>
}

function RouteState({ state, loading }) {
  const { refresh } = useExtensions()
  const { user } = useIndexContext()
  const retrying = RETRYING.has(state)
  useEffect(() => {
    if (!retrying) return undefined
    const timer = window.setInterval(() => refresh(), RETRY_MS)
    const again = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', again)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', again)
    }
  }, [retrying, refresh])

  if (loading) return <Shell title="Проверяем доступ…"><p>Загружаем настройки раздела закупок.</p></Shell>
  if (retrying) {
    return <Shell title="Закупки перезапускаются">
      <p>Сервис обновляется или ненадолго недоступен — обычно это занимает 1–2 минуты. Страница проверит снова сама и откроет раздел, как только он ответит.</p>
      <p><button type="button" onClick={() => refresh()}>Проверить сейчас</button></p>
    </Shell>
  }
  if (state === 'permission-denied') {
    return <Shell title="Нет доступа к закупкам">
      <p>У учётной записи{user?.email ? <> <b>{user.email}</b></> : ''} нет прав на этот раздел. Попросите администратора закупок выдать вам роль.</p>
      <p><button type="button" onClick={() => refresh({ quiet: false })}>Проверить снова</button></p>
    </Shell>
  }
  const [title, message] = stateCopy[state] || ['Раздел закупок недоступен', 'Попробуйте позже.']
  return <Shell title={title}><p>{message}</p></Shell>
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
