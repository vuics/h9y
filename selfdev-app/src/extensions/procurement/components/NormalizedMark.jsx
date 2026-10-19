import React from 'react'
import { CircleCheck } from './icons'

// A quiet "this substance is identified" next to the card number and CAS.
// Only the positive case is marked: a doubt has its own red badge where it
// has to be acted on, and a mark for "not yet" on every row would be noise.
export function NormalizedMark({ normalized }) {
  if (!normalized) return null
  return <span className="pr-normalized-mark" title="Вещество нормализовано" role="img" aria-label="Вещество нормализовано">
    <CircleCheck size={12} />
  </span>
}
