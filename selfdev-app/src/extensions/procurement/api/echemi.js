export const echemiUnits = ['KG', 'G', 'MG', 'MT', 'L', 'PCS', '20FCL', '40FCL', 'BOU']
export const echemiTerms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DDP', 'DAP', 'DPU']

export function initialEchemiDelivery(targetVolume) {
  const match = String(targetVolume || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)$/)
  return {
    quantity: match ? match[1].replace(',', '.') : '',
    unit: match && echemiUnits.includes(match[2].toUpperCase()) ? match[2].toUpperCase() : 'KG',
    shipmentTerm: 'CIP', destination: '', country: 'RU',
  }
}

export function echemiOperationIsError(operation) {
  return Boolean(operation && /(FAILED|NOT_READY|DISABLED|BLOCKED|REQUIRES|CONFIGURATION_REQUIRED|NEEDS_REVIEW)/.test(operation.code))
}

export function echemiOperationLabel(operation) {
  const labels = {
    ECHEMI_SEARCH_COMPLETED: 'Поиск Echemi завершён, результаты сохранены.',
    ECHEMI_INQUIRY_PREPARED: 'Черновик формы создан. На Echemi ничего не отправлено.',
    ECHEMI_INQUIRY_ALREADY_PREPARED: 'Такой черновик уже существует; новый дубликат не создан.',
    ECHEMI_INQUIRY_FORM_FILLED: 'Форма заполнена и готова к визуальной проверке в noVNC.',
    ECHEMI_INQUIRY_APPROVED: 'Просмотренная форма явно согласована. Отправки ещё не было.',
    ECHEMI_INQUIRY_ALREADY_APPROVED: 'Форма уже согласована. Отправки ещё не было.',
    ECHEMI_INQUIRY_SUBMITTED: 'Echemi подтвердил отправку inquiry.',
    ECHEMI_ALREADY_SUBMITTED: 'Inquiry уже был отправлен ранее.',
    ECHEMI_SUBMISSION_NEEDS_REVIEW: 'Echemi не дал однозначного подтверждения после клика. Проверьте состояние вручную и не повторяйте отправку.',
    ECHEMI_SUBMISSION_DISABLED: 'Отправка выключена настройкой ECHEMI_ENABLE_SUBMISSION.',
    HUMAN_ACTION_REQUIRED: 'Echemi запросил ручную проверку. Пройдите её в открытой браузерной сессии, затем повторите исходное действие.',
  }
  return labels[operation?.code] || operation?.message?.split('\n')[0] || 'Операция завершена.'
}
