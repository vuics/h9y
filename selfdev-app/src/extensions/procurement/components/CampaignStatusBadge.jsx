import React from 'react'
import { StatusBadge } from './StatusBadge'

/** A campaign's state, the same in the list and on the campaign page.
 *
 * Toned here rather than through the shared status map: a campaign's
 * `RUNNING` and `PAUSED` are its own states, and an interrupted campaign is
 * waiting for someone to press «Продолжить», not failing.
 */

export const CAMPAIGN_STATUS = {
  RUNNING: 'Идёт',
  AWAITING_REVIEW: 'Ждёт согласования',
  COMPLETED: 'Завершена',
  FAILED: 'Не выполнена',
  PAUSED: 'На паузе',
  CANCELLED: 'Остановлена',
  INTERRUPTED: 'Прервана перезапуском',
}

const CAMPAIGN_TONE = {
  RUNNING: 'progress',
  AWAITING_REVIEW: 'warning',
  COMPLETED: 'complete',
  FAILED: 'danger',
  PAUSED: 'muted',
  CANCELLED: 'muted',
  INTERRUPTED: 'warning',
}

export function CampaignStatusBadge({ status }) {
  return <StatusBadge status={status} label={CAMPAIGN_STATUS[status] || status} tone={CAMPAIGN_TONE[status]} />
}
