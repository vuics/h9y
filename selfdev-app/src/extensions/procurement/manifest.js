/** @type {import('../registry/contracts').SelfdevExtension} */
const manifest = {
  id: 'procurement',
  title: 'Procurement',
  apiVersion: 1,
  requiredPermissions: ['CARD_READ'],
  navigation: [{
    id: 'procurement',
    label: 'Procurement',
    path: '/procurement',
    icon: 'shopping basket',
  }],
  routes: [{ path: '/procurement/*', component: null }],
  commands: [{
    id: 'procurement.open-agent-conversation',
    label: 'Ask Procurement Agent',
    requiredPermissions: ['CARD_READ'],
  }],
}

export default manifest
