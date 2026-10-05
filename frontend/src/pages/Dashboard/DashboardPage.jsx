import { useCallback, useEffect, useState } from 'react'
import DashboardHeader from '../../components/dashboard/DashboardHeader.jsx'
import AssurancePage from '../Assurance/AssurancePage.jsx'
import OperationsPage from '../Operations/OperationsPage.jsx'
import { adminApi, dashboardApi, subscribeToDashboard } from '../../services/api/index.js'
import { formatTime } from '../../utils/formatTime.js'

const viewOptions = [
  { id: 'assurance', label: 'Assurance', summary: 'Platform posture' },
  { id: 'operations', label: 'Operations', summary: 'Service health' },
]

const EMPTY_PLATFORM_LIST = []

function DashboardPage({ auth, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [approvalRequests, setApprovalRequests] = useState([])
  const [activeView, setActiveView] = useState('assurance')
  const [connectionState, setConnectionState] = useState('connecting')

  const handleLogout = useCallback(() => {
    setDashboard(null)
    onLogout()
  }, [onLogout])

  useEffect(() => {
    if (!auth?.token) return undefined

    const hydrate = async () => {
      try {
        const payload = await dashboardApi.getDashboard(auth.token)
        if (payload.dashboard) {
          setDashboard(payload.dashboard)
        }
      } catch (error) {
        if (error.status === 401) {
          handleLogout()
          return
        }
        console.error('Failed to fetch initial dashboard state', error)
      }
    }

    return subscribeToDashboard(auth.token, {
      onConnect: () => {
        setConnectionState('live')
        hydrate()
      },
      onDisconnect: () => setConnectionState('offline'),
      onUpdate: (payload) => setDashboard(payload),
    })
  }, [auth?.token, handleLogout])

  useEffect(() => {
    if (auth?.user?.role !== 'admin') {
      return undefined
    }

    const loadRequests = async () => {
      try {
        setApprovalRequests(await adminApi.getRequests(auth.token))
      } catch (error) {
        console.error('Failed to fetch approval requests', error)
      }
    }

    loadRequests()
    const interval = window.setInterval(loadRequests, 10000)
    return () => window.clearInterval(interval)
  }, [auth?.token, auth?.user?.role])

  const decideRequest = async (requestId, decision) => {
    try {
      await adminApi.decideRequest(auth.token, requestId, decision)
      setApprovalRequests((current) => current.filter((request) => request.id !== requestId))
    } catch (error) {
      console.error('Failed to update access request', error)
    }
  }

  const platforms = dashboard?.platforms ?? EMPTY_PLATFORM_LIST
  const summary = dashboard?.summary ?? { overallHealth: 'healthy', onlineNodes: 0, warningNodes: 0, criticalNodes: 0 }

  const healthDisplay = summary.overallHealth === 'critical' ? 'CRITICAL' : summary.overallHealth === 'warning' ? 'WARNING' : 'HEALTHY'

  return (
    <div className="wrap">
      <DashboardHeader
        auth={auth}
        dashboard={dashboard}
        connectionState={connectionState}
        healthDisplay={healthDisplay}
        approvalRequests={approvalRequests}
        onDecideRequest={decideRequest}
        onLogout={handleLogout}
      />

      <div className="views" role="tablist" aria-label="Dashboard views">
        {viewOptions.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`view-btn ${activeView === view.id ? 'on' : ''}`}
            onClick={() => setActiveView(view.id)}
          >
            <b>{view.label}</b>
            <span>{view.summary}</span>
          </button>
        ))}
      </div>

      <div hidden={activeView !== 'assurance'}>
        <AssurancePage dashboard={dashboard} />
      </div>
      <div hidden={activeView !== 'operations'}>
        <OperationsPage platforms={platforms} />
      </div>
      <footer>
        <div>CS-ASOP / security platform telemetry</div>
        <div>Updated {formatTime(dashboard?.updatedAt)}</div>
        <div>Connection {connectionState === 'live' ? 'stable' : 'unavailable'}</div>
      </footer>
    </div>
  )
}

export default DashboardPage
