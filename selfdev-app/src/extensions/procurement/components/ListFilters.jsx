import React from 'react'
import { Search, Sliders } from './icons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ListFilters({ filters, onChange, placeholder = 'Поиск…', statuses = [], children }) {
  const statusItems = [{ value: 'all', label: 'Все статусы' }, ...statuses]
  return <div className="pr-filters"><label className="pr-search"><Search size={16} /><span className="pr-sr-only">Поиск</span><input value={filters.search || ''} onChange={event => onChange({ search: event.target.value })} placeholder={placeholder} /></label>
    {statuses.length > 0 && <Select selectedKey={filters.status || 'all'} onSelectionChange={value => onChange({ status: value === 'all' ? '' : value })}><SelectTrigger aria-label="Статус"><Sliders size={15} /><SelectValue /></SelectTrigger><SelectContent>{statusItems.map(item => <SelectItem key={item.value} id={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>}
    {children}
  </div>
}
