import React, { useId } from 'react'
import { Select } from '@/components/ui/select'

/**
 * A labelled Select for `pr-form-field` forms.
 *
 * Deliberately NOT a native `<label>`: React Aria's Select renders a hidden
 * real `<select>` for form integration, so a wrapping `<label>` adopts it as its
 * labeled control and re-dispatches every trusted click to it. That fights the
 * Select's own state machine and the selection never applies. The caption is
 * associated with `aria-labelledby` instead, which is also what React Aria asks
 * for, so the "you must specify an aria-label" warning goes away.
 *
 * Inputs and textareas keep using `<label>` — only Select is affected.
 */
export function SelectField({ label, required, hint, wide, children, ...props }) {
  const captionId = useId()
  return (
    <div className={`pr-form-field${wide ? ' pr-form-field--wide' : ''}`}>
      <span id={captionId}>{label}{required && <b> *</b>}</span>
      <Select aria-labelledby={captionId} {...props}>
        {children}
      </Select>
      {hint}
    </div>
  )
}
