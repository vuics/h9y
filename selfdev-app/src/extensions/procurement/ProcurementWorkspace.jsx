import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Menubar from '../../components/Menubar'
import { RouterLinkButton } from '../../components/RouterLinkButton'
import { useExtensions } from '../registry/ExtensionContext'
import { ProcurementErrorBoundary } from './components/ProcurementErrorBoundary'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Sliders } from './components/icons'
import OverviewPage from './pages/OverviewPage'
import RequestsPage from './pages/RequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import CardFormPage from './pages/CardFormPage'
import CardImportPage from './pages/CardImportPage'
import RFQPage from './pages/RFQPage'
import EchemiPage from './pages/EchemiPage'
import SourcingPage from './pages/SourcingPage'
import SuppliersPage from './pages/SuppliersPage'
import SupplierDetailPage from './pages/SupplierDetailPage'
import SupplierFormPage from './pages/SupplierFormPage'
import SupplierCapabilityFormPage from './pages/SupplierCapabilityFormPage'
import SupplierContactFormPage from './pages/SupplierContactFormPage'
import NegotiationsPage from './pages/NegotiationsPage'
import NegotiationDetailPage from './pages/NegotiationDetailPage'
import NegotiationFormPage from './pages/NegotiationFormPage'
import SupplierResponseFormPage from './pages/SupplierResponseFormPage'
import ProposalsPage from './pages/ProposalsPage'
import ProposalDetailPage from './pages/ProposalDetailPage'
import ProposalComparisonPage from './pages/ProposalComparisonPage'
import EscalationsPage from './pages/EscalationsPage'
import EscalationDetailPage from './pages/EscalationDetailPage'
import NegotiatorActivityPage from './pages/NegotiatorActivityPage'
import PlaybookPage from './pages/PlaybookPage'
import PlaybookItemPage from './pages/PlaybookItemPage'
import CommunicationPolicyPage from './pages/CommunicationPolicyPage'
import CompositionsPage from './pages/CompositionsPage'
import CompositionDetailPage from './pages/CompositionDetailPage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'
import '../../shadcn.css'
import './procurement.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

const sections = [
  ['overview', 'Обзор', '/procurement'],
  ['requests', 'Карточки закупок', '/procurement/requests'],
  ['suppliers', 'Поставщики', '/procurement/suppliers'],
  ['negotiations', 'Переговоры', '/procurement/negotiations'],
  ['proposals', 'Предложения', '/procurement/proposals'],
  ['escalations', 'Требует внимания', '/procurement/escalations'],
  ['communication', 'Коммуникация', '/procurement/communication'],
  ['activity', 'Активность и ошибки', '/procurement/activity'],
]

function activeSection(pathname) {
  if (pathname === '/procurement' || pathname === '/procurement/') return 'overview'
  if (pathname.startsWith('/procurement/settings')) return 'settings'
  return sections.find(([, , path]) => path !== '/procurement' && pathname.startsWith(path))?.[0] || 'overview'
}

function Workspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const { usingDevelopmentFixtures } = useExtensions()
  const tab = activeSection(location.pathname)
  return <div className="procurement-host"><div className="pr-host-menu"><Menubar /></div><main className="procurement-shell">
    <header className="pr-workspace-header"><div><div className="pr-eyebrow">AI Sourcing Agent</div><h1>Procurement</h1><p>Операционный контур поиска, проверки поставщиков и сбора предложений.</p></div><div className="pr-inline-actions"><RouterLinkButton to="/procurement/settings" variant="outline"><Sliders size={16} />Настройки</RouterLinkButton><RouterLinkButton to="/chat?context=procurement"><MessageSquare size={16} />Спросить Procurement Agent</RouterLinkButton></div></header>
    {usingDevelopmentFixtures && <div className="pr-fixture-banner" role="status">Режим визуальной разработки: показаны явно включённые демонстрационные данные, не данные production.</div>}
    <Tabs selectedKey={tab} onSelectionChange={value => navigate(sections.find(item => item[0] === value)[2])}><TabsList variant="line" aria-label="Разделы Procurement">{sections.map(([value, label]) => <TabsTrigger key={value} id={value}>{label}</TabsTrigger>)}</TabsList></Tabs>
    <div className="pr-page"><Routes><Route index element={<OverviewPage />} /><Route path="requests" element={<RequestsPage />} /><Route path="requests/new" element={<CardFormPage />} /><Route path="requests/import" element={<CardImportPage />} /><Route path="requests/import/:importId" element={<CardImportPage />} /><Route path="requests/:requestId/edit" element={<CardFormPage />} /><Route path="requests/:requestId/rfq" element={<RFQPage />} /><Route path="requests/:requestId/echemi" element={<EchemiPage />} /><Route path="requests/:requestId/sourcing" element={<SourcingPage />} /><Route path="requests/:requestId" element={<RequestDetailPage />} /><Route path="suppliers" element={<SuppliersPage />} /><Route path="suppliers/new" element={<SupplierFormPage />} /><Route path="suppliers/:supplierId/capabilities/new" element={<SupplierCapabilityFormPage />} /><Route path="suppliers/:supplierId/contacts/new" element={<SupplierContactFormPage />} /><Route path="suppliers/:supplierId/contacts/:contactId/edit" element={<SupplierContactFormPage />} /><Route path="suppliers/:supplierId" element={<SupplierDetailPage />} /><Route path="negotiations" element={<NegotiationsPage />} /><Route path="negotiations/agent" element={<NegotiatorActivityPage />} /><Route path="negotiations/new" element={<NegotiationFormPage />} /><Route path="negotiations/:negotiationId/responses/new" element={<SupplierResponseFormPage />} /><Route path="negotiations/:negotiationId" element={<NegotiationDetailPage />} /><Route path="proposals" element={<ProposalsPage />} /><Route path="proposals/compare" element={<ProposalComparisonPage />} /><Route path="proposals/:proposalId" element={<ProposalDetailPage />} /><Route path="escalations" element={<EscalationsPage />} /><Route path="escalations/:escalationId" element={<EscalationDetailPage />} /><Route path="communication" element={<PlaybookPage />} /><Route path="communication/policy" element={<CommunicationPolicyPage />} /><Route path="communication/drafts" element={<CompositionsPage />} /><Route path="communication/drafts/:compositionId" element={<CompositionDetailPage />} /><Route path="communication/playbook/new" element={<PlaybookItemPage />} /><Route path="communication/playbook/:itemId" element={<PlaybookItemPage />} /><Route path="activity" element={<ActivityPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/procurement" replace />} /></Routes></div>
  </main></div>
}

export default function ProcurementWorkspace() {
  return <ProcurementErrorBoundary><QueryClientProvider client={queryClient}><Workspace /></QueryClientProvider></ProcurementErrorBoundary>
}
