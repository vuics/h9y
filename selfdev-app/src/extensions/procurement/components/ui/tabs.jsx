import React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from './utils'

export const Tabs = TabsPrimitive.Root
export const TabsList = React.forwardRef(({ className, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn('pr-tabs', className)} {...props} />)
export const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => <TabsPrimitive.Trigger ref={ref} className={cn('pr-tabs__trigger', className)} {...props} />)
export const TabsContent = React.forwardRef(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('pr-tabs__content', className)} {...props} />)
TabsList.displayName = 'TabsList'
TabsTrigger.displayName = 'TabsTrigger'
TabsContent.displayName = 'TabsContent'
