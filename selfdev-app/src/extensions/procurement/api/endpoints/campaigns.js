/** Campaigns: one launch applied to many cards.
 *
 * Deliberately thin. The launch payload is built once in `RunLaunchPanel` and
 * passed through whole, so a setting added to the panel reaches the API
 * without a second place having to learn its name.
 */

import { fixtures, mutation, read } from '../devMode'
import { id, request } from '../http'

export const campaignEndpoints = {
  campaigns: read(
    signal => request('/campaigns', { signal }),
    async () => (await fixtures()).campaignList,
  ),
  campaign: read(
    (campaignId, signal) => request(`/campaigns/${id(campaignId)}`, { signal }),
    async campaignId => (await fixtures()).campaignFixtureById(campaignId),
  ),
  startCampaign: mutation(payload =>
    request('/campaigns', { method: 'post', data: payload })),
  cancelCampaign: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/cancel`, { method: 'post' })),
  resumeCampaign: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/resume`, { method: 'post' })),
  // Holding a run, as opposed to ending it. Cancelling is final, so it used to
  // be the only way to make a campaign stand still and the only way cost the
  // campaign.
  pauseCampaign: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/pause`, { method: 'post' })),
  unpauseCampaign: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/unpause`, { method: 'post' })),
  campaignReview: read(
    (campaignId, signal) => request(`/campaigns/${id(campaignId)}/review`, { signal }),
    async campaignId => (await fixtures()).campaignReviewFixture(campaignId),
  ),
  prepareCampaignRfqs: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/review/prepare`, { method: 'post' })),
  applyCampaignReview: mutation((campaignId, decisions) =>
    request(`/campaigns/${id(campaignId)}/review`, { method: 'post', data: { decisions } })),
  // Approving already dispatches. This is for the campaigns approved before it
  // did, and for the substances whose first attempt failed on one supplier.
  dispatchCampaignOutreach: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/outreach`, { method: 'post' })),
  campaignConversations: read(
    (campaignId, signal) => request(`/campaigns/${id(campaignId)}/conversations`, { signal }),
    async campaignId => (await fixtures()).campaignConversationsFixture(campaignId),
  ),
  sendCampaignConversations: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/conversations/send`, { method: 'post' })),
}
