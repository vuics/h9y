import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => ({
    ...defaults,
    ...Object.fromEntries(searchParams.entries()),
  }), [defaults, searchParams])

  const setFilters = useCallback(patch => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null || value === defaults[key]) next.delete(key)
        else next.set(key, String(value))
      })
      if (!Object.prototype.hasOwnProperty.call(patch, 'page')) next.delete('page')
      return next
    }, { replace: true })
  }, [defaults, setSearchParams])

  return [filters, setFilters]
}
