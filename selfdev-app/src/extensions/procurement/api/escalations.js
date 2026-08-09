export const escalationOutcomes = [
  { value: 'PROCEED', label: 'Продолжить переговоры' },
  { value: 'REQUEST_CLARIFICATION', label: 'Запросить уточнение' },
  { value: 'STOP_NEGOTIATION', label: 'Остановить переговоры' },
]

export const escalationOutcomeLabel = value =>
  escalationOutcomes.find(item => item.value === value)?.label || value || 'Не указано'

export function escalationActions(status) {
  return {
    canClaim: status === 'OPEN' || status === 'RECOMMENDED',
    canRecommend: status === 'OPEN' || status === 'IN_REVIEW',
    canResolve: status === 'IN_REVIEW' || status === 'RECOMMENDED',
  }
}
