import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

const variants = cva('pr-button', {
  variants: {
    variant: { default: 'pr-button--default', outline: 'pr-button--outline', ghost: 'pr-button--ghost', danger: 'pr-button--danger' },
    size: { default: '', sm: 'pr-button--sm', icon: 'pr-button--icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

export const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(variants({ variant, size }), className)} ref={ref} {...props} />
})
Button.displayName = 'Button'
