import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useProcurementPermissions } from './useProcurementPermissions'
import { mutationMessage, suggestedVerdict, verdictKey } from '../lib/campaignReview'

// Said when the specialist vouches from the approval. Required by the API, and
// true: they confirmed the card's own CAS and name against what PubChem showed.
const CONFIRM_REASON = 'Подтверждено специалистом при согласовании закупки: CAS и название в карточке верны.'

/** The suggestion is the starting position, not a hidden default: the dots
 * arrive already on what the evidence concluded, so the specialist spends
 * their time on the rows they disagree with instead of re-entering the ones
 * they agree with. Only rows the evidence actually concluded something about
 * are filled — an unknown role is precisely the one that needs a human, so
 * it stays blank. Seeded into `verdicts` rather than painted on at render
 * time so that the counter on "Согласовать" and what is submitted are the
 * same thing the operator can see.
 */
function seedVerdicts(items, current) {
  const next = { ...current }
  let changed = false
  for (const item of items) {
    // A substance still in work is shown blocked; preselecting its
    // candidates put them into "Согласовать: N решений" on a page whose
    // every open block read "0 на решении".
    if (item.blockedBy) continue
    for (const candidate of item.candidates) {
      if (candidate.reviewDecision !== 'UNREVIEWED') continue
      const key = verdictKey(item.cardId, candidate.candidateId)
      if (key in next) continue
      next[key] = suggestedVerdict(candidate).value
      changed = true
    }
  }
  return changed ? next : current
}

/** A prepared RFQ starts ticked, like the companies: the button names how
 * many texts it approves, every text is one click from being read, and an
 * untick is remembered. Seeded once per card so a reload of the data never
 * re-ticks what the specialist unticked.
 */
function seedRfqs(items, current) {
  const next = { ...current }
  let changed = false
  for (const item of items) {
    if (item.cardId in next) continue
    if (!item.rfq?.documentFingerprint || item.rfq.status === 'APPROVED') continue
    next[item.cardId] = true
    changed = true
  }
  return changed ? next : current
}

/** The one approval a campaign asks for, wherever it is shown.
 *
 * Both halves of the same question — who do we write to, and what do we ask
 * them — held once for the whole campaign, so that "Согласовать" is one
 * submission and a reload never leaves half the decisions applied and half on
 * screen. The purchase page's positions and its «Согласование» mode read the
 * same hook, so a decision behaves the same in either.
 *
 * `enabled: false` keeps the review unread: it carries every candidate of every
 * substance, which the purchase page needs only once someone asks for it.
 */
export function useCampaignReview(campaignId, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const { canReviewSourcing, canWriteCards } = useProcurementPermissions()

  // `verdicts` is keyed by candidate under substance, `rfqs` by card id.
  const [verdicts, setVerdicts] = useState({})
  const [rfqs, setRfqs] = useState({})
  const [opened, setOpened] = useState({})
  // Decided candidates are folded per substance; unfolding is how a past
  // verdict is changed, and applying folds them again.
  const [revising, setRevising] = useState({})
  const [applied, setApplied] = useState(null)
  const [dispatched, setDispatched] = useState(null)
  const [posted, setPosted] = useState(null)
  // Whether a person changed anything the suggestion put there: only then is
  // leaving the page a loss worth asking about.
  const [touched, setTouched] = useState(false)

  const query = useQuery({
    queryKey: procurementKeys.campaignReview(campaignId),
    queryFn: ({ signal }) => procurementApi.campaignReview(campaignId, signal),
    enabled,
  })

  const accept = data => {
    queryClient.setQueryData(procurementKeys.campaignReview(campaignId), data)
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
  }
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareCampaignRfqs(campaignId),
    onSuccess: accept,
  })
  const apply = useMutation({
    mutationFn: decisions => procurementApi.applyCampaignReview(campaignId, decisions),
    onSuccess: data => {
      accept(data)
      setApplied(data.results || [])
      setDispatched(data.outreach || null)
      setPosted(data.marketplace || null)
      setVerdicts({})
      setRfqs({})
      setRevising({})
      setTouched(false)
    },
  })
  // Settling the identity of several cards at once, then writing the RFQs that
  // were waiting on it: an RFQ is written only for a confirmed identity, so the
  // two are one step for the person, not two buttons.
  const identity = useMutation({
    mutationFn: async ({ action, cardIds, cas }) => {
      const failed = []
      for (const cardId of cardIds) {
        try {
          if (action === 'recheck') await procurementApi.normalizeCard(cardId)
          if (action === 'confirm') await procurementApi.confirmCardNormalization(cardId, CONFIRM_REASON)
          if (action === 'replaceCas') {
            await procurementApi.updateCard(cardId, { cas_number: cas })
            await procurementApi.normalizeCard(cardId)
          }
        } catch (error) {
          failed.push({ cardId, message: mutationMessage(error) })
        }
      }
      const prepared = canWriteCards
        ? await procurementApi.prepareCampaignRfqs(campaignId).catch(() => null)
        : null
      return { failed, prepared }
    },
    onSuccess: ({ prepared }) => {
      if (prepared) accept(prepared)
      else queryClient.invalidateQueries({ queryKey: procurementKeys.campaignReview(campaignId) })
    },
  })

  // Memoised because the empty-array fallback is a fresh value on every render,
  // which would make every derived list below recompute for nothing.
  const items = useMemo(() => query.data?.items || [], [query.data?.items])
  const actionable = useMemo(() => items.filter(item => !item.blockedBy), [items])
  const identityItems = useMemo(() => items.filter(item => item.normalization), [items])

  // Over every substance, not only those waiting: a verdict on a substance
  // whose letters have gone can still be corrected, and a company left
  // undecided there can still be written to.
  const decisions = useMemo(() => items.map(item => {
    const candidates = item.candidates
      .filter(candidate => {
        const chosen = verdicts[verdictKey(item.cardId, candidate.candidateId)]
        return chosen && chosen !== candidate.reviewDecision
      })
      .map(candidate => ({
        candidateId: candidate.candidateId,
        decision: verdicts[verdictKey(item.cardId, candidate.candidateId)],
      }))
    const fingerprint = rfqs[item.cardId] && item.rfq?.status !== 'APPROVED' ? item.rfq?.documentFingerprint : null
    return { cardId: item.cardId, candidates, ...(fingerprint ? { rfqFingerprint: fingerprint } : {}) }
  }).filter(decision => decision.candidates.length || decision.rfqFingerprint), [items, verdicts, rfqs])

  // Counted separately from the substances: "Согласовать (1)" on a page where
  // one substance carries a candidate verdict and an RFQ approval reads as one
  // decision when it is two, and the operator is about to send both.
  const candidateCount = decisions.reduce((total, item) => total + item.candidates.length, 0)
  const rfqCount = decisions.filter(item => item.rfqFingerprint).length

  useEffect(() => {
    if (!items.length) return
    setVerdicts(current => seedVerdicts(items, current))
    setRfqs(current => seedRfqs(items, current))
  }, [items])

  const missingRfqs = items.filter(item => item.rfq && item.rfq.status === 'NOT_PREPARED' && !item.normalization).length
  const appliedById = new Map((applied || []).map(result => [result.cardId, result]))
  // A CAS the name contradicts is never settled in bulk: that is the one case
  // where the letter would ask for the wrong substance.
  const confirmable = identityItems.filter(item => item.normalization.casMatches !== false)

  // One choice for many rows: every undecided company of a substance, or of
  // the whole campaign. Only fills the dots — nothing is recorded until
  // "Согласовать", so a bulk pick is reviewed like any other.
  const openTargets = scope => scope
    .filter(item => !item.blockedBy)
    .flatMap(item => item.candidates
      .filter(candidate => candidate.reviewDecision === 'UNREVIEWED')
      .map(candidate => [item, candidate]))
  const setAll = (scope, value, { withContactsOnly = false } = {}) => {
    setTouched(true)
    setVerdicts(current => {
      const next = { ...current }
      for (const [item, candidate] of openTargets(scope)) {
        if (withContactsOnly && !candidate.contactCount) continue
        next[verdictKey(item.cardId, candidate.candidateId)] = value
      }
      return next
    })
  }
  const suggestAll = scope => {
    setTouched(true)
    setVerdicts(current => {
      const next = { ...current }
      for (const [item, candidate] of openTargets(scope)) {
        next[verdictKey(item.cardId, candidate.candidateId)] = suggestedVerdict(candidate).value
      }
      return next
    })
  }
  const choose = (key, value) => {
    setTouched(true)
    setVerdicts(current => ({ ...current, [key]: value }))
  }
  const tickRfq = (cardId, value) => {
    setTouched(true)
    setRfqs(current => ({ ...current, [cardId]: value }))
  }
  // Back to what the evidence suggested, as if the review had just opened.
  const reset = useCallback(() => {
    setVerdicts(seedVerdicts(items, {}))
    setRfqs(seedRfqs(items, {}))
    setTouched(false)
  }, [items])

  return {
    campaignId, query, review: query.data, items, actionable, identityItems, confirmable,
    verdicts, rfqs, opened, setOpened, revising, setRevising,
    applied, appliedById, dispatched, posted, touched,
    prepare, apply, identity, decisions, candidateCount, rfqCount, missingRfqs,
    openTargets, setAll, suggestAll, choose, tickRfq, reset,
    canReviewSourcing, canWriteCards,
  }
}
