import React, { useEffect, useRef, useState } from 'react'

import { MoreVertical } from './icons'

/** The per-substance actions nobody needs while reading the table.
 *
 * Positioned against the viewport rather than the row: the table scrolls
 * inside its own box, and a menu laid out inside it is cut off at the edge.
 */
export function RowMenu({ label, children }) {
  const [at, setAt] = useState(null)
  const button = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!at) return undefined
    const close = event => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menu.current?.contains(event.target)) setAt(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', () => setAt(null), { once: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [at])
  const open = () => {
    const rect = button.current?.getBoundingClientRect()
    setAt(rect ? { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) } : null)
  }
  return <>
    <button
      ref={button}
      type="button"
      className="pr-row-menu__trigger"
      aria-label={label}
      aria-expanded={Boolean(at)}
      onClick={() => (at ? setAt(null) : open())}
    ><MoreVertical size={16} /></button>
    {at && <div ref={menu} className="pr-row-menu" role="menu" style={{ top: at.top, right: at.right }} onClick={() => setAt(null)}>
      {children}
    </div>}
  </>
}
