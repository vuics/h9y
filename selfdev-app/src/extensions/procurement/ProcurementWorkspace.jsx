import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Menubar from '../../components/Menubar'
import { RouterLinkButton } from '../../components/RouterLinkButton'
import { useExtensions } from '../registry/ExtensionContext'
import { ProcurementErrorBoundary } from './components/ProcurementErrorBoundary'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare } from './components/icons'
import OverviewPage from './pages/OverviewPage'
import RequestsPage from './pages/RequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import CardFormPage from './pages/CardFormPage'
import SuppliersPage from './pages/SuppliersPage'
import SupplierDetailPage from './pages/SupplierDetailPage'
import NegotiationsPage from './pages/NegotiationsPage'
import NegotiationDetailPage from './pages/NegotiationDetailPage'
import ProposalsPage from './pages/ProposalsPage'
import ProposalDetailPage from './pages/ProposalDetailPage'
import ProposalComparisonPage from './pages/ProposalComparisonPage'
import EscalationsPage from './pages/EscalationsPage'
import ActivityPage from './pages/ActivityPage'
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
  ['activity', 'Активность и ошибки', '/procurement/activity'],
]

function activeSection(pathname) {
  if (pathname === '/procurement' || pathname === '/procurement/') return 'overview'
  return sections.find(([, , path]) => path !== '/procurement' && pathname.startsWith(path))?.[0] || 'overview'
}

function Workspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const { usingDevelopmentFixtures } = useExtensions()
  const tab = activeSection(location.pathname)
  return <div className="procurement-host"><div className="pr-host-menu"><Menubar /></div><main className="procurement-shell">
    <header className="pr-workspace-header"><div><div className="pr-eyebrow">AI Sourcing Agent</div><h1>Procurement</h1><p>Операционный контур поиска, проверки поставщиков и сбора предложений.</p></div><RouterLinkButton to="/chat?context=procurement"><MessageSquare size={16} />Спросить Procurement Agent</RouterLinkButton></header>
    {usingDevelopmentFixtures && <div className="pr-fixture-banner" role="status">Режим визуальной разработки: показаны явно включённые демонстрационные данные, не данные production.</div>}
    <Tabs selectedKey={tab} onSelectionChange={value => navigate(sections.find(item => item[0] === value)[2])}><TabsList variant="line" aria-label="Разделы Procurement">{sections.map(([value, label]) => <TabsTrigger key={value} id={value}>{label}</TabsTrigger>)}</TabsList></Tabs>
    <div className="pr-page"><Routes><Route index element={<OverviewPage />} /><Route path="requests" element={<RequestsPage />} /><Route path="requests/new" element={<CardFormPage />} /><Route path="requests/:requestId/edit" element={<CardFormPage />} /><Route path="requests/:requestId" element={<RequestDetailPage />} /><Route path="suppliers" element={<SuppliersPage />} /><Route path="suppliers/:supplierId" element={<SupplierDetailPage />} /><Route path="negotiations" element={<NegotiationsPage />} /><Route path="negotiations/:negotiationId" element={<NegotiationDetailPage />} /><Route path="proposals" element={<ProposalsPage />} /><Route path="proposals/compare" element={<ProposalComparisonPage />} /><Route path="proposals/:proposalId" element={<ProposalDetailPage />} /><Route path="escalations" element={<EscalationsPage />} /><Route path="activity" element={<ActivityPage />} /><Route path="*" element={<Navigate to="/procurement" replace />} /></Routes></div>
  </main></div>
}

export default function ProcurementWorkspace() {
  return <ProcurementErrorBoundary><QueryClientProvider client={queryClient}><Workspace /></QueryClientProvider></ProcurementErrorBoundary>
}
