/** How the purchase table is read: one list of positions, folded differently.
 *
 * A mode does not swap the table for another one. It decides which positions
 * are opened and which of their three sections — offers, conversations,
 * Echemi — start unfolded. Whatever a person opens or folds by hand afterwards
 * stays as they left it until the mode changes.
 */

export const SECTIONS = ['offers', 'threads', 'echemi', 'escalations', 'review']

export const MODES = [
  ['members', 'Только позиции'],
  ['offers', 'Предложения'],
  ['threads', 'Переписки'],
  ['echemi', 'Echemi'],
  ['escalations', 'Эскалации'],
  // Last, like its section: a step done once at the start, while the offers
  // are what the purchase is opened for. When it waits, its badge says so.
  ['review', 'Согласование'],
  ['all', 'Всё'],
]

const MODE_IDS = MODES.map(([id]) => id)

/** The mode in the address; links from before the switch said "marketplace". */
export function modeOf(value) {
  if (value === 'marketplace') return 'echemi'
  return MODE_IDS.includes(value) ? value : 'members'
}

/** Whether a position waits for its approval, read from the purchase alone:
 * the approval itself is loaded only when someone asks for it.
 */
export const memberAwaitsReview = member => member.stage === 'AWAITING_REVIEW'
  || ['CANDIDATE_REVIEW', 'RFQ_APPROVAL'].includes(member.waitingFor)

/** What one position has to show in each section. */
export const contentOf = ({ offers = [], threads = [], marketplace = null, review = false, escalations = [] } = {}) => ({
  review: review ? 1 : 0,
  escalations: escalations.length,
  offers: offers.length,
  threads: threads.length,
  echemi: marketplace ? 1 : 0,
})

/** Whether a mode opens a position: only when it has something for that mode.
 *
 * Opening all twenty-eight rows for offers would put twelve "no offers yet"
 * between the ones that have them. When no position has anything for the mode
 * — a purchase whose approval is long done — every position opens instead, so
 * the mode shows its section everywhere rather than an unchanged table.
 */
export function rowOpenByMode(mode, content, { anyHas = true } = {}) {
  if (mode === 'all') return true
  if (SECTIONS.includes(mode)) return !anyHas || content[mode] > 0
  return false
}

/** Whether a section of an opened position starts unfolded: only the one
 * the mode is about. A conversation waiting for a person says so in its
 * folded header and on the Переписки button, so it does not open itself.
 */
export const sectionOpenByMode = (mode, section) => mode === 'all' || mode === section

/** A person's choice wins over the mode's, until the mode changes. */
export const resolveOpen = (overrides, key, byMode) => (overrides.has(key) ? overrides.get(key) : byMode)
