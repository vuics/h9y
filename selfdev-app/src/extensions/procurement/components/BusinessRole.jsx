import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Building, CircleAlert, Flask } from './icons'

export const businessRoleLabels = {
  MANUFACTURER: 'Производитель',
  DISTRIBUTOR: 'Дистрибьютор',
  BOTH: 'Производитель и дистрибьютор',
  UNKNOWN: 'Под вопросом',
}

// On whose word the role stands. The wording matters more than it looks: a
// trader that writes "manufacturer" in its own marketplace profile produces
// exactly the same badge as a plant we checked, and only this line tells the
// two apart.
export const businessRoleSourceLabels = {
  MANUAL: 'отмечено вручную',
  SOURCING_REVIEW: 'из проверки кандидата',
  PLATFORM_PROFILE: 'со слов площадки',
  NONE: 'нет данных',
}

export const businessRoleLabel = role => businessRoleLabels[role] || 'Под вопросом'

export function BusinessRoleBadge({ role, source, conflict, compact = false }) {
  const known = role && role !== 'UNKNOWN'
  const Icon = !known ? CircleAlert : role === 'DISTRIBUTOR' ? Flask : Building
  const origin = businessRoleSourceLabels[source]
  return <span className="pr-business-role">
    <Badge variant={known ? 'outline' : 'secondary'} title={origin ? `Роль ${businessRoleLabel(role)} — ${origin}` : businessRoleLabel(role)}>
      <Icon size={compact ? 12 : 13} />{businessRoleLabel(role)}
    </Badge>
    {!compact && origin && source !== 'NONE' && <small>{origin}</small>}
    {conflict && <small className="pr-business-role__conflict" title="Проверка и профиль на площадке говорят разное"><AlertTriangle size={12} />расхождение</small>}
  </span>
}
