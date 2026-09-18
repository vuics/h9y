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

export function readableAgentError(text) {
  if (!text) return text
  return String(text)
    .split('\n')
    .map(line => line.replace(/\s*Inquiry created:\s*(YES|NO)\s*$/i, ''))
    .filter(line => !MARKER_LINE.test(line))
    .join('\n')
    .replace(LEADING_CODE, '')
    .trim()
}
