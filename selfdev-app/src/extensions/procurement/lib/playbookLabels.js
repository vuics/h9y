/** Russian labels for the playbook's closed vocabularies.
 *
 * The vocabularies themselves come from `GET /v1/communication/vocabulary`, so
 * the workspace never invents a value the backend does not know. Only the
 * wording lives here, and an unknown key falls back to the raw value rather
 * than rendering blank.
 */

export const KIND_LABELS = {
  DIRECTIVE: 'Директивы',
  BLOCK: 'Блоки ответов',
  LOCKED_CLAUSE: 'Обязательные формулировки',
}

export const KIND_SINGULAR = {
  DIRECTIVE: 'Директива',
  BLOCK: 'Блок ответа',
  LOCKED_CLAUSE: 'Обязательная формулировка',
}

export const TOPIC_LABELS = {
  APPLICATION: 'Применение',
  VOLUME: 'Объём',
  GRADE: 'Грейд',
  DOCUMENTS: 'Документы',
  DELIVERY_TERMS: 'Условия поставки',
  SAMPLE: 'Образец',
  PAYMENT: 'Оплата',
  COMPANY: 'О компании',
}

export const STAGE_LABELS = {
  FIRST_CONTACT: 'Первый контакт',
  CLARIFICATION: 'Уточнение',
  FOLLOW_UP: 'Напоминание',
  NEGOTIATION: 'Переговоры',
  CLOSING: 'Завершение',
}

export const GUARD_LABELS = {
  TARGET_PRICE: 'ориентир цены',
  TARGET_VOLUME: 'целевой объём',
  APPLICATION_AREA: 'область применения',
  SPECIALIST_COMMENTS: 'комментарии специалиста',
}

export const TRIGGER_LABELS = {
  FIRST_CONTACT: 'первое обращение',
  INBOUND_MESSAGE: 'ответ поставщика',
  SCHEDULED_FOLLOW_UP: 'запланированное напоминание',
  MANUAL: 'ручной запуск',
}

export const COMPOSITION_STATUS_LABELS = {
  DRAFT: 'Ожидает подтверждения',
  BLOCKED: 'Заблокировано проверками',
  APPROVED: 'Подтверждено, ожидает отправки',
  SENT: 'Отправлено',
  REJECTED: 'Отклонено',
}

export const CHECK_LABELS = {
  NOT_EMPTY: 'Сообщение не пустое',
  LOCKED_CLAUSES_PRESENT: 'Обязательные формулировки на месте',
  VERBATIM_BLOCKS_PRESENT: 'Дословные блоки не изменены',
  NO_FORBIDDEN_DISCLOSURE: 'Закрытые данные не раскрыты',
  NO_UNFILLED_PLACEHOLDER: 'Нет незаполненных заготовок',
}

export const label = (dictionary, value) => dictionary[value] || value
