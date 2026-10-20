import React from 'react'
import { Link, useParams } from 'react-router-dom'

import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { CopyableId } from '../components/CopyableId'
import { BulkVerdicts, IdentitySummary, ReviewActions, ReviewAlerts, ReviewItem } from '../components/CampaignReview'
import { useCampaignReview } from '../hooks/useCampaignReview'
import { blockedText } from '../lib/campaignReview'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** The one approval a campaign asks for.
 *
 * Both halves of the same question — who do we write to, and what do we ask
 * them — on one page, one block per substance. The gates behind it are
 * unchanged: a candidate is verified with an explicit verdict, and an RFQ is
 * approved against the fingerprint of the document displayed here. What this
 * screen removes is the two hundred page loads, not the decision.
 *
 * The purchase page now carries the same approval in each position, and no
 * link leads here any more: the page answers its old address only, for a
 * bookmark, on the same state and blocks, and goes once nobody needs that.
 */
export default function CampaignReviewPage() {
  const { campaignId } = useParams()
  const review = useCampaignReview(campaignId)
  const { query, items, actionable } = review

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const data = review.review
  if (!data) return <EmptyState title="Закупка не найдена" />

  return <DetailLayout
    backTo={`/procurement/campaigns/${campaignId}`}
    backLabel="К закупке"
    eyebrow={<CopyableId value={data.campaignId} />}
    title="Согласование закупки"
    status={<Badge variant="secondary">{data.pendingCandidates} на решении</Badge>}
    meta={`${data.title} · ${actionable.length} из ${items.length} веществ готовы к согласованию`}
    warnings={<ReviewAlerts review={review} />}
  >
    <div className="pr-stack">
      <IdentitySummary review={review} card />

      <Card><CardHeader><div>
        <CardTitle>Одно решение на всю закупку</CardTitle>
        <p>Кому пишем и что спрашиваем — по каждому веществу. Компании и тексты RFQ уже отмечены по рекомендации: проверьте, снимите лишнее и нажмите одну кнопку. Кандидат становится поставщиком только с этим подтверждением.</p>
      </div></CardHeader><CardContent>
        <div className="pr-inline-actions">
          <ReviewActions review={review} />
        </div>
        <BulkVerdicts review={review} scope={items} />
      </CardContent></Card>

      {items.length === 0 && <EmptyState title="В закупке нет веществ" />}

      {items.map(item => {
        const open = item.candidates.filter(candidate => candidate.reviewDecision === 'UNREVIEWED')
        return <Card key={item.cardId} id={`review-${item.cardId}`} className="pr-review-block"><CardHeader><div>
          <CardTitle>{item.title}</CardTitle>
          <p>
            <CopyableId value={item.cardId} displayValue={`#${item.cardId}`} to={`/procurement/requests/${item.cardId}`} />
            {' · CAS '}{item.casNumber || 'не указан'}
            {' · '}<Link to={`/procurement/requests/${item.cardId}/sourcing`}>поиск кандидатов</Link>
          </p>
        </div>{item.blockedBy
          ? <Badge variant="outline">{blockedText(item.blockedBy)}</Badge>
          : <Badge variant="secondary">{open.length} на решении</Badge>}
        </CardHeader><CardContent>
          <ReviewItem review={review} item={item} />
        </CardContent></Card>
      })}
    </div>
  </DetailLayout>
}
