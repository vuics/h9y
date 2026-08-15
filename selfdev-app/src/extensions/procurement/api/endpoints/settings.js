import { mutation, read } from '../devMode'
import { request } from '../http'

const payload = settings => ({
  organization: {
    display_name: settings.organization.displayName,
    legal_name: settings.organization.legalName || null,
    country: settings.organization.country || null,
    address: settings.organization.address || null,
    website: settings.organization.website || null,
    description: settings.organization.description || null,
  },
  senders: settings.senders.map(sender => ({
    sender_id: sender.senderId || null,
    user_id: sender.userId || null,
    display_name: sender.displayName,
    job_title: sender.jobTitle || null,
    department: sender.department || null,
    email: sender.email,
    phone_country: sender.phoneCountry,
    phone_number: sender.phoneNumber,
    preferred_language: sender.preferredLanguage || null,
    signature: sender.signature || null,
    active: sender.active !== false,
  })),
  default_sender_id: settings.defaultSenderId,
})

const emptyFixture = {
  organization: { displayName: '', legalName: '', country: '', address: '', website: '', description: '' },
  senders: [], defaultSenderId: null, source: 'DEVELOPMENT_FIXTURE', revision: 0,
}

export const settingsEndpoints = {
  buyerSettings: read(
    signal => request('/settings/buyer', { signal }),
    async () => emptyFixture,
  ),
  saveBuyerSettings: mutation(settings => request('/settings/buyer', {
    method: 'put', data: payload(settings),
  })),
}
