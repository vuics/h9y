/** How the purchase table is read: one list of positions, folded differently.
 *
 * A mode does not swap the table for another one. It decides which positions
 * are opened and which of their three sections — offers, conversations,
 * Echemi — start unfolded. Whatever a person opens or folds by hand afterwards
 * stays as they left it until the mode changes.
 */

export const SECTIONS = ['offers', 'threads', 'echemi']

export const MODES = [
  ['members', 'Позиции'],
  ['offers', 'Предложения'],
  ['threads', 'Переписки'],
  ['echemi', 'Echemi'],
  ['all', 'Всё'],
]

const MODE_IDS = MODES.map(([id]) => id)

/** The mode in the address; links from before the switch said "marketplace". */
export function modeOf(value) {
  if (value === 'marketplace') return 'echemi'
  return MODE_IDS.includes(value) ? value : 'members'
}

/** What one position has to show in each section. */
export const contentOf = ({ offers = [], threads = [], marketplace = null } = {}) => ({
  offers: offers.length,
  threads: threads.length,
  echemi: marketplace ? 1 : 0,
})

/** Whether a mode opens a position: only when it has something for that mode.
 *
 * Opening all twenty-eight rows for offers would put twelve "no offers yet"
 * between the ones that have them.
 */
export function rowOpenByMode(mode, content) {
  if (mode === 'all') return true
  if (SECTIONS.includes(mode)) return content[mode] > 0
  return false
}

/** Whether a section of an opened position starts unfolded.
 *
 * A conversation waiting for a person is never folded away by a mode: it is
 * the one thing in the row somebody has to act on.
 */
export function sectionOpenByMode(mode, section, { waiting = false } = {}) {
  if (mode === 'all' || mode === section) return true
  return section === 'threads' && waiting
}

/** A person's choice wins over the mode's, until the mode changes. */
export const resolveOpen = (overrides, key, byMode) => (overrides.has(key) ? overrides.get(key) : byMode)
