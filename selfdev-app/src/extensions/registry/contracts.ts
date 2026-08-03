import type { ComponentType, LazyExoticComponent } from 'react'

export interface NavigationContribution {
  id: string
  label: string
  path: string
  icon?: string
}

export interface RouteContribution {
  path: string
  component: LazyExoticComponent<ComponentType>
}

export interface CommandContribution {
  id: string
  label: string
  requiredPermissions?: string[]
}

export interface SelfdevExtension {
  id: string
  title: string
  apiVersion: 1
  requiredPermissions?: string[]
  navigation?: NavigationContribution[]
  routes: RouteContribution[]
  commands?: CommandContribution[]
}

export interface ExtensionCapability {
  id: string
  title?: string
  enabled: boolean
  apiVersion: number
  permissions: string[]
  serviceAvailable?: boolean
  reason?: string
}

export interface ExtensionsResponse {
  apiVersion: 1
  extensions: ExtensionCapability[]
}
