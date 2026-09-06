import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Check, Copy } from './icons'

/** An identifier, copyable and — where it names something — openable.
 *
 * `to` is on this component rather than on each caller because every screen
 * that shows a card number shows it through here: a specialist who reads
 * "#320 — карточка не нормализована" wants to be on #320, and adding the link
 * once is what makes that true everywhere instead of on the page somebody
 * remembered.
 */
export function CopyableId({ value, displayValue = value, to }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef(null)

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value))
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(false), 1600)
  }

  const label = copied ? `ID ${value} скопирован` : `Скопировать ID ${value}`
  return <span className="pr-copyable-id">{to
    ? <Link to={to}>{displayValue}</Link>
    : <span>{displayValue}</span>}<Button type="button" variant="ghost" size="icon-xs" aria-label={label} title={label} onPress={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}</Button></span>
}
