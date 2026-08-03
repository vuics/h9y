import React from 'react'
import { cn } from './utils'

export const Card = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn('pr-card', className)} {...props} />)
export const CardHeader = ({ className, ...props }) => <div className={cn('pr-card__header', className)} {...props} />
export const CardTitle = ({ className, ...props }) => <h3 className={cn('pr-card__title', className)} {...props} />
export const CardDescription = ({ className, ...props }) => <p className={cn('pr-card__description', className)} {...props} />
export const CardContent = ({ className, ...props }) => <div className={cn('pr-card__content', className)} {...props} />
export const CardFooter = ({ className, ...props }) => <div className={cn('pr-card__footer', className)} {...props} />
Card.displayName = 'Card'
