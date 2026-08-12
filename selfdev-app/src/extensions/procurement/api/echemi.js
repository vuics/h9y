export const echemiUnits = ['KG', 'G', 'MG', 'MT', 'L', 'PCS', '20FCL', '40FCL', 'BOU']
export const echemiTerms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DDP', 'DAP', 'DPU']

export function echemiReadiness(cardStatus, rfqStatus) {
  const searchReady = cardStatus === 'NORMALIZED'
  return { searchReady, inquiryReady: searchReady && rfqStatus === 'APPROVED' }
}

// The card volume is parsed by the backend, which also understands Cyrillic
// units and container codes. Re-parsing it here would drift from the validator
// that later accepts or rejects the inquiry.
export function initialEchemiDelivery(target) {
  const parsed = target && typeof target === 'object' ? target : null
  const unit = parsed?.unit && echemiUnits.includes(parsed.unit) ? parsed.unit : 'KG'
  return {
    quantity: parsed?.quantity != null ? String(parsed.quantity) : '',
    unit,
    shipmentTerm: 'CIP', destination: '', country: 'RU',
  }
}

// Mirrors the server rule: the same mass expressed in another unit is fine,
// anything else is not. Factors come from the backend, not a second table.
export function quantityMatchesCard(target, quantity, unit) {
  if (!target?.parsed) return { state: 'UNKNOWN' }
  const entered = Number(String(quantity).replace(',', '.'))
  if (!Number.isFinite(entered) || entered <= 0) return { state: 'INVALID' }
  const factors = target.massFactors || {}
  const cardFactor = factors[target.unit]
  const enteredFactor = factors[unit]
  if (cardFactor && enteredFactor) {
    const cardBase = target.quantity * cardFactor
    const enteredBase = entered * enteredFactor
    const equal = Math.abs(cardBase - enteredBase) <= Math.max(1e-9, Math.abs(cardBase) * 1e-9)
    return { state: equal ? 'MATCHES' : 'DIFFERS', converted: equal && unit !== target.unit }
  }
  if (unit !== target.unit) return { state: 'DIFFERS' }
  const equal = Math.abs(target.quantity - entered) <= Math.max(1e-9, Math.abs(target.quantity) * 1e-9)
  return { state: equal ? 'MATCHES' : 'DIFFERS' }
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
