import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight } from './icons'
import { EmptyState } from './AsyncState'
import { shouldOpenTableRow } from './tableInteractions'

export function DataTable({ columns, rows, rowKey = 'id', onRowClick, emptyTitle, emptyDescription }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return <div className="pr-table-wrap"><table className="pr-table"><thead><tr>{columns.map(column => <th key={column.id} className={column.className}>{column.header}</th>)}{onRowClick && <th aria-label="Открыть" />}</tr></thead>
    <tbody>{rows.map(row => <tr key={row[rowKey]} onClick={onRowClick ? event => {
      if (shouldOpenTableRow(event)) onRowClick(row)
    } : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={event => { if (onRowClick && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) onRowClick(row) }}>
      {columns.map(column => <td key={column.id} className={column.className}>{column.cell ? column.cell(row) : row[column.id]}</td>)}
      {onRowClick && <td className="pr-table__open"><Button variant="ghost" size="icon" aria-label={`Открыть ${row[rowKey]}`} onPress={() => onRowClick(row)}><ChevronRight size={16} /></Button></td>}
    </tr>)}</tbody></table></div>
}

export function Pagination({ page = 1, pageSize = 20, total, hasMore, onChange }) {
  const lastPage = total == null ? null : Math.max(1, Math.ceil(total / pageSize))
  if (page <= 1 && !hasMore && (!lastPage || lastPage <= 1)) return null
  return <div className="pr-pagination"><span>{total == null ? `Страница ${page}` : `${total} записей · страница ${page} из ${lastPage}`}</span><div><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Назад</Button><Button variant="outline" size="sm" disabled={lastPage ? page >= lastPage : !hasMore} onClick={() => onChange(page + 1)}>Далее</Button></div></div>
}

/** Tail of an infinitely scrolling list: progress, the scroll sentinel and a
 * manual fallback for readers who never reach the end of the viewport. */
export function InfiniteListFooter({ sentinelRef, loaded, total, hasNextPage, isFetchingNextPage, onLoadMore }) {
  if (!loaded && !hasNextPage) return null
  return <div className="pr-pagination" ref={sentinelRef}><span>{isFetchingNextPage ? 'Загружаем ещё…' : total == null ? `Показано ${loaded}` : `Показано ${loaded} из ${total}`}</span><div>{hasNextPage && <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={onLoadMore}>Показать ещё</Button>}</div></div>
}
