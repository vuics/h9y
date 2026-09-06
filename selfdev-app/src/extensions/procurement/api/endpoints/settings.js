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
  // Omitted rather than emptied when the page has not loaded it: the server
  // reads an absent `delivery` as "leave as it was", so a save that forgot to
  // restate it must not reset where the goods are going.
  ...(settings.delivery ? {
    delivery: {
      incoterm: settings.delivery.incoterm,
      destination: settings.delivery.destination || null,
      destinationCountry: settings.delivery.destinationCountry || null,
    },
  } : {}),
})

const emptyFixture = {
  organization: { displayName: '', legalName: '', country: '', address: '', website: '', description: '' },
  delivery: { incoterm: 'CIF', destination: '', destinationCountry: '' },
  deliveryTerms: ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
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
