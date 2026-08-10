import { fileToBase64 } from './responses.js'

export const importLimits = { maxFileBytes: 15 * 1024 * 1024 }

// Mirrors IMPORTABLE_CARD_FIELDS in card_import/models.py.
export const importFieldLabels = {
  substance_name: 'Наименование вещества',
  cas_number: 'CAS-номер',
  purity: 'Чистота',
  application_area: 'Область применения',
  target_volume: 'Целевой объём',
  price_guideline: 'Ориентир цены',
  specialist_comments: 'Комментарий специалиста',
}

export const importRowStatusLabels = {
  READY: 'Готова',
  DRAFT: 'Черновик',
  DUPLICATE: 'Дубль',
  EMPTY: 'Пустая',
  UNIDENTIFIED: 'Не опознана',
  CREATED: 'Карточка создана',
  SKIPPED: 'Пропущена',
  FAILED: 'Ошибка',
}

// StatusBadge's shared labels read COMPLETED as "Поиск завершён", which is
// sourcing wording; an import needs its own.
export const importStatusLabels = {
  ANALYZING: 'Разбираем файл',
  AWAITING_CONFIRMATION: 'Ждёт подтверждения',
  CREATING: 'Создаём карточки',
  NORMALIZING: 'Сверяем с PubChem',
  COMPLETED: 'Импорт завершён',
  FAILED: 'Импорт не выполнен',
  CANCELLED: 'Импорт остановлен',
}

// Mirrors NORMALIZATION_OUTCOMES in card_import/projection.py.
export const normalizationOutcomeLabels = {
  NORMALIZED: 'подтверждено',
  NEEDS_REVIEW: 'расхождение',
  NOT_FOUND: 'не найдено',
  FAILED: 'ошибка',
}

export const importStageLabels = {
  RECOGNIZING: 'Распознаём файл',
  MAPPING: 'Определяем столбцы',
  AWAITING_CONFIRMATION: 'Ждём подтверждения',
  CREATING: 'Создаём карточки',
  NORMALIZING: 'Сверяем с PubChem',
  DONE: 'Готово',
}

export const importMappingSourceLabels = {
  SYNONYM: 'по названию столбца',
  MODEL: 'предложено моделью',
  SPECIALIST: 'задано вами',
  UNMAPPED: 'не используется',
}

export function validateImportFile(file) {
  if (!file) return 'Выберите файл со списком веществ.'
  if (file.size === 0) return 'Файл пустой.'
  if (file.size > importLimits.maxFileBytes) return 'Размер файла не должен превышать 15 МБ.'
  return null
}

export async function importFilePayload(file) {
  return { filename: file.name, data_base64: await fileToBase64(file) }
}

/**
 * Rows the specialist can choose to import.
 *
 * `policy` is the duplicate policy about to be applied, which during review is
 * the specialist's current choice — not `run.duplicatePolicy`, which only holds
 * what was stored at confirmation time. Reading the stored value here meant
 * choosing CREATE never actually included the duplicates.
 */
export function selectableRows(run, policy = run?.duplicatePolicy) {
  const creatable = new Set(['READY', 'DRAFT'])
  return (run?.rows || []).filter(row =>
    creatable.has(row.status) ||
    (row.status === 'DUPLICATE' && policy === 'CREATE'),
  )
}

/** Rows that will not produce a card, with the reason already computed. */
export function excludedRows(run, policy = run?.duplicatePolicy) {
  const selectable = new Set(selectableRows(run, policy).map(row => row.rowNumber))
  return (run?.rows || []).filter(row => !selectable.has(row.rowNumber))
}

export function isImportEditable(run) {
  return run?.status === 'AWAITING_CONFIRMATION'
}

export function isImportRunning(run) {
  return ['ANALYZING', 'CREATING', 'NORMALIZING'].includes(run?.status)
}

/** Created cards still awaiting the optional PubChem pass. */
export function pendingNormalizationCount(run) {
  return (run?.rows || []).filter(
    row => row.createdCardId != null && !row.normalizationStatus,
  ).length
}
