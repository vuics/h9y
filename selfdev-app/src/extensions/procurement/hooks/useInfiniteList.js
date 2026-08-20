import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

/** Read a paginated list as one growing list that loads while the user scrolls.
 *
 * `fetchPage(page, signal)` must resolve the usual page shape (`items`, `page`,
 * `total`, `hasMore`). Attach the returned `sentinelRef` to an element at the
 * end of the list: once it comes into view the next page is requested, so the
 * reader never has to reach for a pager.
 */
export function useInfiniteList({ queryKey, fetchPage, ...options }) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 1, signal }) => fetchPage(pageParam, signal),
    getNextPageParam: last => (last?.hasMore ? (Number(last.page) || 1) + 1 : undefined),
    keepPreviousData: true,
    ...options,
  })
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const [sentinel, setSentinel] = useState(null)

  useEffect(() => {
    if (!sentinel || !hasNextPage || isFetchingNextPage) return undefined
    if (typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) fetchNextPage()
    }, { rootMargin: '240px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage])

  const pages = query.data?.pages ?? []
  return {
    ...query,
    items: pages.flatMap(page => page?.items ?? []),
    total: pages[0]?.total,
    sentinelRef: setSentinel,
  }
}
