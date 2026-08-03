import React from 'react'
import { cn } from './utils'
export const Skeleton = ({ className, ...props }) => <div className={cn('pr-skeleton', className)} {...props} />
