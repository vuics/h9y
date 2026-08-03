import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from './icons'

export function CopyableId({ value, displayValue = value }) {
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
  return <span className="pr-copyable-id"><span>{displayValue}</span><Button type="button" variant="ghost" size="icon-xs" aria-label={label} title={label} onPress={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}</Button></span>
}
