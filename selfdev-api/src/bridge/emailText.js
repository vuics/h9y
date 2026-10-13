import { convert } from 'html-to-text'

// The text a supplier wrote, whichever part of the email holds it.
//
// Many clients send an email whose text/plain part is empty, or a single
// line, while the HTML part carries the whole letter. Dideu's offers arrived
// that way: the bridge passed on the empty text part and the procurement
// side saw an email with nothing in it but two signature images.
export function emailBodyText(parsed) {
  const text = typeof parsed?.text === 'string' ? parsed.text : ''
  if (text.trim()) return text
  const html = typeof parsed?.html === 'string' ? parsed.html : ''
  if (!html.trim()) return ''
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'table', format: 'dataTable' },
    ],
  }).trim()
}
