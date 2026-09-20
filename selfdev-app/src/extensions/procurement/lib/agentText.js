/** An agent tool's answer as a person should read it.
 *
 * The marketplace tools answer the chat agent in a machine-readable shape — a
 * leading code ("ECHEMI_INQUIRY_NOT_READY: …") and marker lines such as
 * "Inquiry created: NO" — and the campaign stores that answer as the reason a
 * request did not go out. The code and markers are for the agent; the
 * sentence is for the purchaser.
 */
const MARKER_LINE = /^\s*(Inquiry created|Status|Submitted|Posted):\s*\S+\s*$/i
const LEADING_CODE = /^\s*[A-Z][A-Z0-9_]{3,}:\s*/

// What the browser recorded before it spoke Russian. The message is stored on
// the substance and stays there until the request is attempted again, so it is
// translated on the way out rather than left on screen in English.
const STORED_ENGLISH = [
  [
    /The submit control was clicked, but no configured Echemi success confirmation was detected\.\s*Do not retry automatically\./gi,
    'Кнопка отправки нажата, но подтверждения площадки мы не увидели. Повторять автоматически не будем: заявка могла уйти. Проверьте её в браузере.',
  ],
  [/\bThe page said:/gi, 'Площадка сказала:'],
  [/\bInquiry created:\s*(YES|NO)\b/gi, ''],
]

export function readableAgentError(text) {
  if (!text) return text
  const translated = STORED_ENGLISH.reduce((value, [pattern, russian]) => value.replace(pattern, russian), String(text))
  return translated
    .split('\n')
    .map(line => line.replace(/\s*Inquiry created:\s*(YES|NO)\s*$/i, ''))
    .filter(line => !MARKER_LINE.test(line))
    .join('\n')
    .replace(LEADING_CODE, '')
    .trim()
}
