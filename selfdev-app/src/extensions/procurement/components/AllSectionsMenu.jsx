import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { MORE_SECTIONS } from '../lib/navigation'
import { ChevronDown } from './icons'

/** «Все разделы»: every screen that is not one of the three tabs.
 *
 * The expert's way in — the register, suppliers, the playbook, the journal —
 * kept one click away rather than removed, so nothing that worked before is
 * gone, only out of the purchaser's first view.
 */
export function AllSectionsMenu({ canManageAccess, classic, onClassicChange }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const sections = MORE_SECTIONS.filter(([id]) => id !== 'access' || canManageAccess)
  return <div className="pr-more" ref={root}>
    <Button variant="outline" aria-expanded={open} aria-haspopup="menu" onPress={() => setOpen(value => !value)}>
      Все разделы<ChevronDown size={15} />
    </Button>
    {open && <div className="pr-more__menu" role="menu">
      {sections.map(([id, label, to]) => <Link key={id} role="menuitem" to={to}>{label}</Link>)}
      <label className="pr-more__classic">
        <input type="checkbox" checked={classic} onChange={event => onClassicChange(event.target.checked)} />
        <span>Классическое меню</span>
      </label>
    </div>}
  </div>
}
