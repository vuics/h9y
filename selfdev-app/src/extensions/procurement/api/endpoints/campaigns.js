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
  // Only for a held or stopped campaign that never started a substance: the
  // duplicates a repeated launch leaves. The server refuses anything else.
  deleteCampaign: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/delete`, { method: 'post' })),
  // Changes how the rest of the campaign runs; the answer carries `effects`:
  // substances picked up again, and approval steps now taken by the campaign.
  changeCampaignSettings: mutation((campaignId, payload) =>
    request(`/campaigns/${id(campaignId)}/settings`, { method: 'post', data: payload })),
  addCampaignCards: mutation((campaignId, cardIds) =>
    request(`/campaigns/${id(campaignId)}/members`, { method: 'post', data: { cardIds } })),
  removeCampaignCard: mutation((campaignId, cardId) =>
    request(`/campaigns/${id(campaignId)}/members/${id(cardId)}/remove`, { method: 'post' })),
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
  // Requests on the marketplace, which are not conversations: one per
  // substance, published to every seller, with no contact behind them. The
  // read answers from the cards, so it still works while the browser worker
  // that posts them is down.
  campaignMarketplace: read(
    (campaignId, signal) => request(`/campaigns/${id(campaignId)}/marketplace`, { signal }),
    async campaignId => (await fixtures()).campaignMarketplaceFixture(campaignId),
  ),
  dispatchCampaignMarketplace: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/marketplace`, { method: 'post' })),
  // The marketplace half of "отправить все подготовленные": the forms are
  // filled and checked, and this is the one press that puts them on the
  // platform instead of one approval per substance.
  submitCampaignMarketplace: mutation(campaignId =>
    request(`/campaigns/${id(campaignId)}/marketplace/submit`, { method: 'post' })),
  // One substance the platform never confirmed: ask its own list whether the
  // request is there, then either record it or send it.
  resendCampaignMarketplace: mutation((campaignId, cardId) =>
    request(`/campaigns/${id(campaignId)}/marketplace/${id(cardId)}/resend`, { method: 'post' })),
}
