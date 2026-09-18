import React, { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Menubar from '../../components/Menubar'
import { RouterLinkButton } from '../../components/RouterLinkButton'
import { useExtensions } from '../registry/ExtensionContext'
import { useProcurementPermissions } from './hooks/useProcurementPermissions'
import { ProcurementErrorBoundary } from './components/ProcurementErrorBoundary'
import { MessageSquare } from './components/icons'
import { AllSectionsMenu } from './components/AllSectionsMenu'
import { procurementApi } from './api/client'
import { procurementKeys } from './api/queryKeys'
import { CLASSIC_SECTIONS, MORE_SECTIONS, PRIMARY_SECTIONS, sectionLabel, sectionOf } from './lib/navigation'
import DashboardPage from './pages/DashboardPage'
import OverviewPage from './pages/OverviewPage'
import RequestsPage from './pages/RequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import CardFormPage from './pages/CardFormPage'
import CardImportPage from './pages/CardImportPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignPage from './pages/CampaignPage'
import CampaignReviewPage from './pages/CampaignReviewPage'
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
import PlaybookImportPage from './pages/PlaybookImportPage'
import PlaybookPage from './pages/PlaybookPage'
import VariantPerformancePage from './pages/VariantPerformancePage'
import PlaybookItemPage from './pages/PlaybookItemPage'
import CommunicationPolicyPage from './pages/CommunicationPolicyPage'
import CompositionsPage from './pages/CompositionsPage'
import CompositionDetailPage from './pages/CompositionDetailPage'
import ActivityPage from './pages/ActivityPage'
import AccessPage from './pages/AccessPage'
import SettingsPage from './pages/SettingsPage'
import '../../shadcn.css'
import './procurement.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

const CLASSIC_KEY = 'procurement.classicMenu'

function readClassic() {
  try { return window.localStorage.getItem(CLASSIC_KEY) === 'true' } catch { return false }
}

function writeClassic(value) {
  try { window.localStorage.setItem(CLASSIC_KEY, String(value)) } catch { /* the choice lasts this visit */ }
}

/** The counts the tabs carry: what waits for a person, and the offers in hand.
 *
 * Read from queries the pages already make, so a badge and the page it opens
 * never disagree. A figure the server does not report yet is left off rather
 * than shown as zero.
 */
function useTabCounts() {
  const overview = useQuery({ queryKey: procurementKeys.overview(), queryFn: ({ signal }) => procurementApi.overview({ signal }), staleTime: 30000, retry: 1 })
  const campaigns = useQuery({ queryKey: procurementKeys.campaigns(), queryFn: ({ signal }) => procurementApi.campaigns(signal), staleTime: 30000, retry: 1 })
  const kpis = overview.data?.kpis || {}
  const approvals = (campaigns.data?.items || []).filter(item => item.status !== 'CANCELLED' && item.progress?.awaitingReview > 0).length
  return {
    escalations: kpis.needsSpecialist == null ? null : kpis.needsSpecialist + approvals,
    proposals: kpis.pricedProposals ?? null,
  }
}

function Workspace() {
  const location = useLocation()
  const { usingDevelopmentFixtures } = useExtensions()
  const { canManageAccess } = useProcurementPermissions()
  const [classic, setClassic] = useState(readClassic)
  const counts = useTabCounts()
  const section = sectionOf(location.pathname)
  const tabs = classic ? CLASSIC_SECTIONS : PRIMARY_SECTIONS
  const selected = tabs.some(([id]) => id === section) ? section : null
  const changeClassic = value => { setClassic(value); writeClassic(value) }
  return <div className="procurement-host"><div className="pr-host-menu"><Menubar /></div><main className="procurement-shell">
    <header className="pr-workspace-header pr-workspace-header--compact"><div><h1>ИИ-ассистент закупок</h1></div><div className="pr-inline-actions"><RouterLinkButton to="/chat?context=procurement" variant="outline"><MessageSquare size={16} />Спросить агента</RouterLinkButton><AllSectionsMenu canManageAccess={canManageAccess} classic={classic} onClassicChange={changeClassic} /></div></header>
    {usingDevelopmentFixtures && <div className="pr-fixture-banner" role="status">Режим визуальной разработки: показаны явно включённые демонстрационные данные, не данные production.</div>}
    {/* Links rather than a tab widget: a screen from «Все разделы» selects no
        tab, and a widget that must always select one kept jumping back to the
        first, looping. A link is also what a middle-click can open aside. */}
    <nav className={classic ? 'pr-tabs pr-tabs--classic' : 'pr-tabs'} aria-label="Разделы закупок">{tabs.map(([value, label, to]) => <Link key={value} to={to} className="pr-tab" aria-current={value === selected ? 'page' : undefined}>{label}{!classic && counts[value] > 0 && <span className="pr-tab-count">{counts[value]}</span>}</Link>)}</nav>
    {!selected && sectionLabel(section) && <nav className="pr-section-trail" aria-label="Где вы"><span>Все разделы</span><span aria-hidden="true">›</span><Link to={MORE_SECTIONS.find(([id]) => id === section)?.[2] || '/procurement'}>{sectionLabel(section)}</Link></nav>}
    <div className="pr-page"><Routes><Route index element={<CampaignsPage />} /><Route path="overview" element={<OverviewPage />} /><Route path="dashboard" element={<DashboardPage />} /><Route path="requests" element={<RequestsPage />} /><Route path="requests/new" element={<CardFormPage />} /><Route path="requests/import" element={<CardImportPage />} /><Route path="requests/import/:importId" element={<CardImportPage />} /><Route path="requests/:requestId/edit" element={<CardFormPage />} /><Route path="requests/:requestId/rfq" element={<RFQPage />} /><Route path="requests/:requestId/echemi" element={<EchemiPage />} /><Route path="requests/:requestId/sourcing" element={<SourcingPage />} /><Route path="requests/:requestId" element={<RequestDetailPage />} /><Route path="campaigns" element={<CampaignsPage />} /><Route path="campaigns/:campaignId/review" element={<CampaignReviewPage />} /><Route path="campaigns/:campaignId" element={<CampaignPage />} /><Route path="suppliers" element={<SuppliersPage />} /><Route path="suppliers/new" element={<SupplierFormPage />} /><Route path="suppliers/:supplierId/capabilities/new" element={<SupplierCapabilityFormPage />} /><Route path="suppliers/:supplierId/contacts/new" element={<SupplierContactFormPage />} /><Route path="suppliers/:supplierId/contacts/:contactId/edit" element={<SupplierContactFormPage />} /><Route path="suppliers/:supplierId" element={<SupplierDetailPage />} /><Route path="negotiations" element={<NegotiationsPage />} /><Route path="negotiations/agent" element={<NegotiatorActivityPage />} /><Route path="negotiations/new" element={<NegotiationFormPage />} /><Route path="negotiations/:negotiationId/responses/new" element={<SupplierResponseFormPage />} /><Route path="negotiations/:negotiationId" element={<NegotiationDetailPage />} /><Route path="proposals" element={<ProposalsPage />} /><Route path="proposals/compare" element={<ProposalComparisonPage />} /><Route path="proposals/:proposalId" element={<ProposalDetailPage />} /><Route path="escalations" element={<EscalationsPage />} /><Route path="escalations/:escalationId" element={<EscalationDetailPage />} /><Route path="communication" element={<PlaybookPage />} /><Route path="communication/policy" element={<CommunicationPolicyPage />} /><Route path="communication/performance" element={<VariantPerformancePage />} /><Route path="communication/drafts" element={<CompositionsPage />} /><Route path="communication/drafts/:compositionId" element={<CompositionDetailPage />} /><Route path="communication/imports" element={<PlaybookImportPage />} /><Route path="communication/imports/:importId" element={<PlaybookImportPage />} /><Route path="communication/playbook/new" element={<PlaybookItemPage />} /><Route path="communication/playbook/:itemId" element={<PlaybookItemPage />} /><Route path="activity" element={<ActivityPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="access" element={<AccessPage />} /><Route path="*" element={<Navigate to="/procurement" replace />} /></Routes></div>
  </main></div>
}

export default function ProcurementWorkspace() {
  return <ProcurementErrorBoundary><QueryClientProvider client={queryClient}><Workspace /></QueryClientProvider></ProcurementErrorBoundary>
}
