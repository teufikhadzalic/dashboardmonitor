import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  autoConnect: false,
})

const viewOptions = [
  { id: 'assurance', label: 'Assurance', summary: 'Platform posture' },
  { id: 'operations', label: 'Operations', summary: 'Service health' },
]

const statusTone = {
  healthy: 'ok',
  warning: 'watch',
  critical: 'exposed',
  online: 'ok',
  offline: 'exposed',
  up: 'ok',
  deg: 'watch',
  down: 'exposed',
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function reasonSeverity(reason) {
  return reason.includes('critical') || reason.includes('offline') ? 'critical' : 'warning'
}

function reasonMessage(reason, instanceId) {
  const prefix = `${instanceId} `
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason
}

function formatTime(value) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [canReapply, setCanReapply] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setCanReapply(false)
    setIsSubmitting(true)

    try {
      const response = await fetch(`http://localhost:3000/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) {
        setCanReapply(payload.code === 'ACCOUNT_REJECTED')
        throw new Error(payload.error || 'Unable to authenticate')
      }
      if (payload.pending) {
        setError(payload.message)
        setMode('login')
        return
      }
      onAuthenticated(payload)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reapply = async () => {
    setError('')
    setCanReapply(false)
    setIsSubmitting(true)

    try {
      const response = await fetch('http://localhost:3000/api/auth/reapply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to re-apply')
      setError(payload.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">CS-ASOP / platform dashboard</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-copy">Access live security platform assurance.</p>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Register</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required />
              </label>
            </>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {canReapply && (
            <button className="reapply-btn" type="button" onClick={reapply} disabled={isSubmitting}>
              Appeal was rejected, re-apply?
            </button>
          )}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </section>
    </main>
  )
}

function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('cs-asop-auth') || 'null'))
  const [dashboard, setDashboard] = useState(null)
  const [approvalRequests, setApprovalRequests] = useState([])
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [activeView, setActiveView] = useState('assurance')
  const [selectedPlatformId, setSelectedPlatformId] = useState(null)
  const [graphPlatformId, setGraphPlatformId] = useState(null)
  const [selectedInstanceId, setSelectedInstanceId] = useState(null)
  const [connectionState, setConnectionState] = useState('connecting')
  const [operationsQuery, setOperationsQuery] = useState('')
  const [operationsFilters, setOperationsFilters] = useState({ platform: '', status: '', health: '', datacenter: '', environment: '', os: '' })
  const [selectedOperationKey, setSelectedOperationKey] = useState(null)

  useEffect(() => {
    if (!auth?.token) return undefined

    const hydrate = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/dashboard', { headers: { Authorization: `Bearer ${auth.token}` } })
        if (response.status === 401) {
          localStorage.removeItem('cs-asop-auth')
          setAuth(null)
          return
        }
        const payload = await response.json()
        if (payload.dashboard) {
          setDashboard(payload.dashboard)
          setSelectedPlatformId((current) => current || payload.dashboard.platforms?.[0]?.id || null)
        }
      } catch (error) {
        console.error('Failed to fetch initial dashboard state', error)
      }
    }

    socket.auth = { token: auth.token }
    socket.connect()
    socket.on('connect', () => {
      setConnectionState('live')
      hydrate()
    })
    socket.on('disconnect', () => setConnectionState('offline'))
    socket.on('dashboard:update', (payload) => setDashboard(payload))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('dashboard:update')
      socket.disconnect()
    }
  }, [auth?.token])

  useEffect(() => {
    if (auth?.user?.role !== 'admin') {
      setApprovalRequests([])
      return undefined
    }

    const loadRequests = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/admin/requests', { headers: { Authorization: `Bearer ${auth.token}` } })
        if (response.ok) setApprovalRequests((await response.json()).requests ?? [])
      } catch (error) {
        console.error('Failed to fetch approval requests', error)
      }
    }

    loadRequests()
    const interval = window.setInterval(loadRequests, 10000)
    return () => window.clearInterval(interval)
  }, [auth?.token, auth?.user?.role])

  const handleAuthenticated = (payload) => {
    localStorage.setItem('cs-asop-auth', JSON.stringify(payload))
    setAuth(payload)
  }

  const logout = () => {
    localStorage.removeItem('cs-asop-auth')
    setDashboard(null)
    setAuth(null)
  }

  const decideRequest = async (requestId, decision) => {
    const response = await fetch(`http://localhost:3000/api/admin/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ decision }),
    })
    if (response.ok) setApprovalRequests((current) => current.filter((request) => request.id !== requestId))
  }

  const platforms = dashboard?.platforms ?? []
  const security = dashboard?.security ?? { sessionsBypassingPAM: 0, outOfHoursAccess: 0, failedLogins: 0, blockedThreats: 0 }
  const summary = dashboard?.summary ?? { overallHealth: 'healthy', onlineNodes: 0, warningNodes: 0, criticalNodes: 0 }

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === selectedPlatformId) ?? platforms[0],
    [platforms, selectedPlatformId],
  )

  const selectedInstance = useMemo(
    () => selectedPlatform?.instances?.find((instance) => instance.id === selectedInstanceId),
    [selectedPlatform, selectedInstanceId],
  )

  const graphSeries = graphPlatformId
    ? (platforms.find((platform) => platform.id === graphPlatformId)?.instances ?? []).map((instance) => ({ ...instance, label: instance.id }))
    : platforms.map((platform) => ({
      ...platform,
      platformId: platform.id,
      cpu: platform.aggregate?.cpu ?? platform.cpu,
      memory: platform.aggregate?.memory ?? platform.ram,
      label: platform.shortName,
    }))

  const selectPlatform = (platformId) => {
    setSelectedPlatformId(platformId)
    setGraphPlatformId(platformId)
    setSelectedInstanceId(null)
  }

  const selectInstance = (instanceId) => setSelectedInstanceId(instanceId)

  const serviceRows = useMemo(
    () => platforms.flatMap((platform) =>
      (platform.instances ?? []).flatMap((instance, instanceIndex) => {
        const service = platform.services?.[instanceIndex % (platform.services?.length || 1)]
        if (!service) return []
        return [{
          ...service,
          ...instance,
          serviceName: service.name,
          serviceId: service.id,
          platformId: platform.id,
          platformName: platform.name,
          role: platform.role,
          serviceStatus: instance.serviceStatus ?? (service.status === 'down' ? 'offline' : service.status === 'deg' ? 'degraded' : 'online'),
          serviceState: instance.serviceStatus === 'offline' ? 'down' : instance.serviceStatus === 'degraded' || instance.status === 'warning' ? 'deg' : 'up',
          health: instance.status ?? platform.status,
          operationKey: `${platform.id}-${instance.id}-${service.id}`,
        }]
      })
    ),
    [platforms],
  )

  const operationOptions = useMemo(() => ({
    platforms: [...new Set(serviceRows.map((row) => row.platform))].filter(Boolean),
    datacenters: [...new Set(serviceRows.map((row) => row.datacenter))].filter(Boolean),
    environments: [...new Set(serviceRows.map((row) => row.environment))].filter(Boolean),
    os: [...new Set(serviceRows.map((row) => row.os))].filter(Boolean),
  }), [serviceRows])

  const filteredServiceRows = useMemo(() => {
    const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
    const query = normalize(operationsQuery)
    return serviceRows.filter((row) => {
      const searchable = normalize([row.serviceName, row.serviceId, row.platform, row.platformName, row.id, row.hostname, row.ipAddress, row.os, row.osVersion, row.datacenter, row.region, row.environment, row.serviceStatus, row.serviceState, row.health].filter(Boolean).join(' '))
      const matchesQuery = !query || searchable.includes(query)
      const matches = (key, value) => !value || normalize(row[key]) === normalize(value)
      return matchesQuery
        && matches('platform', operationsFilters.platform)
        && matches('serviceState', operationsFilters.status)
        && matches('health', operationsFilters.health)
        && matches('datacenter', operationsFilters.datacenter)
        && matches('environment', operationsFilters.environment)
        && matches('os', operationsFilters.os)
    })
  }, [operationsFilters, operationsQuery, serviceRows])

  const clearOperationFilters = () => {
    setOperationsQuery('')
    setOperationsFilters({ platform: '', status: '', health: '', datacenter: '', environment: '', os: '' })
  }

  const selectedOperation = filteredServiceRows.find((row) => row.operationKey === selectedOperationKey)

  const alerts = useMemo(() => {
    const list = []
    const siem = platforms.find((platform) => platform.id === 'siem')
    const splunk = siem?.services?.find((service) => service.id === 'splunkd-indexing')

    if (splunk?.status === 'deg') {
      list.push('SIEM is reporting a degraded splunkd — indexing process while host remains online.')
    }

    const ansible = platforms.find((platform) => platform.id === 'ansible')
    if (ansible?.diskAvailableDays <= 28) {
      list.push(`Ansible hardening host is at ${ansible.diskAvailableDays} days of disk headroom.`)
    }

    if (security.sessionsBypassingPAM >= 6 || security.outOfHoursAccess >= 30) {
      list.push('PAM/MFA anomalies: sessions bypassing PAM and out-of-hours access are elevated.')
    }

    if (!list.length) {
      list.push('No active anomalies. The core CS-ASOP estate is stable.')
    }

    return list
  }, [platforms, security])

  const exposureList = useMemo(() => {
    const items = [
      {
        label: 'PAM bypass',
        score: security.sessionsBypassingPAM,
        owner: 'PAM',
        severity: security.sessionsBypassingPAM >= 6 ? 'exposed' : security.sessionsBypassingPAM >= 4 ? 'watch' : 'ok',
      },
      {
        label: 'Out-of-hours access',
        score: security.outOfHoursAccess,
        owner: 'MFA',
        severity: security.outOfHoursAccess >= 30 ? 'exposed' : security.outOfHoursAccess >= 20 ? 'watch' : 'ok',
      },
      {
        label: 'Failed logins',
        score: security.failedLogins,
        owner: 'AD / Entra',
        severity: security.failedLogins >= 30 ? 'exposed' : security.failedLogins >= 18 ? 'watch' : 'ok',
      },
    ]

    return items
  }, [security])

  const healthBand = summary.overallHealth === 'critical' ? 'exposed' : summary.overallHealth === 'warning' ? 'watch' : 'ok'
  const healthDisplay = summary.overallHealth === 'critical' ? 'CRITICAL' : summary.overallHealth === 'warning' ? 'WARNING' : 'HEALTHY'

  if (!auth?.token) return <AuthScreen onAuthenticated={handleAuthenticated} />

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="mast-id">
          <p className="eyebrow">CS-ASOP / platform dashboard</p>
          <h1>CS-ASOP platform assurance</h1>
          <p className="mast-sub">Live posture for the nine core security capabilities used to protect identity, access control, detection, automation, and edge enforcement.</p>
          <span className="mockup-flag">9 core platforms</span>
        </div>

        <div className="mast-meta">
          <div>
            <span>Stream</span>
            {connectionState === 'live' ? 'Live' : 'Offline'}
          </div>
          <div>
            <span>Updated</span>
            {formatTime(dashboard?.updatedAt)}
          </div>
          <div>
            <span>State</span>
            {healthDisplay}
          </div>
          <button className="logout-btn" type="button" onClick={logout}>Log out</button>
        </div>
      </header>

      {auth.user?.role === 'admin' && (
        <section className="admin-requests">
          <button className="requests-toggle" type="button" onClick={() => setRequestsOpen((open) => !open)}>
            <span>Access requests</span>
            <b>{approvalRequests.length}</b>
          </button>
          {requestsOpen && (
            <div className="requests-window">
              <div className="requests-heading">
                <div>
                  <h2>Pending users</h2>
                  <p>Approve accounts before they can view the dashboard.</p>
                </div>
                <button type="button" onClick={() => setRequestsOpen(false)} aria-label="Close access requests">Close</button>
              </div>
              {!approvalRequests.length && <p className="empty-requests">No pending requests.</p>}
              {approvalRequests.map((request) => (
                <div className="request-row" key={request.id}>
                  <div>
                    <strong>{request.name}</strong>
                    <span>{request.email}</span>
                  </div>
                  <div className="request-actions">
                    <button type="button" className="approve" onClick={() => decideRequest(request.id, 'approve')}>Approve</button>
                    <button type="button" className="reject" onClick={() => decideRequest(request.id, 'reject')}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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

      {activeView === 'assurance' && <>
      <div className="figures">
        <div className="fig">
          <div className="k">Platform health</div>
          <div className={`v ${healthBand}`}>{healthDisplay}</div>
          <div className="n">{summary.onlineNodes} online / {summary.warningNodes} watch / {summary.criticalNodes} critical</div>
        </div>
        <div className="fig">
          <div className="k">Portfolio</div>
          <div className="v">{platforms.length}<small> / 9</small></div>
          <div className="n">Core CS-ASOP platforms</div>
        </div>
        <div className="fig warn">
          <div className="k">PAM bypass</div>
          <div className="v">{security.sessionsBypassingPAM}</div>
          <div className="n">sessions bypassing policy</div>
        </div>
        <div className="fig alert">
          <div className="k">Out of hours</div>
          <div className="v">{security.outOfHoursAccess}</div>
          <div className="n">access events</div>
        </div>
      </div>

      <div className="sec-head">
        <h2>Platform portfolio</h2>
        <p>Live health across the nine CS-ASOP application domains</p>
      </div>

      <div className="strip" role="tablist" aria-label="Platform portfolio">
        {platforms.map((platform, index) => {
          const active = selectedPlatform?.id === platform.id
          const tone = platform.status === 'critical' ? 'exposed' : platform.status === 'warning' ? 'watch' : 'ok'
          const healthyInstances = (platform.instances ?? []).filter((instance) => instance.status === 'healthy').length

          return (
            <button
              key={platform.id}
              type="button"
              className={`tile ${active ? 'on' : ''}`}
              onClick={() => selectPlatform(platform.id)}
            >
              <div className="t-code">{String(index + 1).padStart(2, '0')}</div>
              <div className="t-name">{platform.shortName}</div>
              <div className="t-vendor">{platform.name}</div>
              <div className={`t-status ${tone === 'ok' ? 's-ok' : tone === 'watch' ? 's-watch' : 's-exposed'}`}>{platform.status.toUpperCase()}</div>
              <div className="t-telemetry">CPU {Math.round(platform.aggregate?.cpu ?? platform.cpu)}% · Mem {Math.round(platform.aggregate?.memory ?? platform.ram)}%</div>
              <div className="t-telemetry">Error {platform.aggregate?.errorRate ?? platform.errorRate ?? 0}% · {healthyInstances}/{platform.instances?.length ?? 0} healthy</div>
              <div className="t-reason">{platform.reasons?.[0] ?? 'All monitored telemetry is within thresholds'}</div>
            </button>
          )
        })}
      </div>
      </>}

      {activeView === 'assurance' && (
        <section className="view on" id="v-assurance" role="tabpanel">
          <div className="two">
            <div className="panel">
              <div className="sec-head">
                <h2>{graphPlatformId ? `${selectedPlatform?.shortName} - Instance telemetry` : 'CS-ASOP platform overview'}</h2>
                <p>{graphPlatformId ? 'Click an instance for detailed telemetry' : 'Mean CPU and memory across each platform; bands show thresholds'}</p>
                <label className="graph-platform-picker">
                  <span>View instances</span>
                  <select value={graphPlatformId ?? ''} onChange={(event) => event.target.value ? selectPlatform(event.target.value) : setGraphPlatformId(null)} aria-label="View platform instances">
                    <option value="">Choose a platform</option>
                    {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.shortName}</option>)}
                  </select>
                </label>
                {graphPlatformId && <button type="button" className="back-btn" onClick={() => { setGraphPlatformId(null); setSelectedInstanceId(null) }}>All platforms</button>}
              </div>

              <div className="plot-frame">
                <div className="plot ready">
                  <div className="zone zone-warning-cpu" />
                  <div className="zone zone-critical-cpu" />
                  <div className="zone zone-warning-memory" />
                  <div className="zone zone-critical-memory" />
                  <div className="zone-label">
                    Threshold bands
                    <span>Yellow: warning · Red: critical</span>
                  </div>

                  {graphSeries.map((series) => {
                    const x = clamp(Number(series.cpu ?? 0), 0, 100)
                    const y = clamp(100 - Number(series.memory ?? series.ram ?? 0), 0, 100)
                    const tone = series.status === 'critical' ? 'd-exposed' : series.status === 'warning' ? 'd-watch' : 'd-ok'
                    const isOn = selectedInstanceId === series.id
                    return (
                      <button
                        key={series.id}
                        type="button"
                        className={`dot ${tone} ${isOn ? 'on' : ''}`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        onClick={() => graphPlatformId ? selectInstance(series.id) : selectPlatform(series.platformId)}
                      >
                        {series.label}
                      </button>
                    )
                  })}
                </div>
                <div className="ax-y">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>
                <div className="ax-title-y">Memory utilization</div>
                <div className="ax-x">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
                <div className="ax-title">CPU utilization</div>
                <div className="plot-legend"><span className="legend-dot" />Point colour = full instance health <span className="legend-band warning" />CPU/memory warning <span className="legend-band critical" />CPU/memory critical</div>
              </div>
            </div>

            <div className="panel">
              <div className="sec-head">
                <h2>Exposure stack</h2>
                <p>Priority watchlist</p>
              </div>
              <ul className="exp">
                {exposureList.map((item) => (
                  <li key={item.label}>
                    <div className="exp-top">
                      <div className={`exp-n ${item.severity === 'ok' ? 's-ok' : item.severity === 'watch' ? 's-watch' : 's-exposed'}`}>{item.score}</div>
                      <div className="exp-t">{item.label}</div>
                    </div>
                    <div className="exp-meta">
                      <span className={`owner ${item.severity === 'exposed' ? 'ext' : ''}`}>{item.owner}</span>
                      <div className="exp-bar"><i className={item.severity === 'ok' ? 'b-ok' : item.severity === 'watch' ? 'b-watch' : 'b-exposed'} style={{ width: `${Math.min(item.score * 12, 100)}%` }} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="drill">
            <div className="drill-head">
              <h2>{selectedInstance ? `${selectedInstance.id} telemetry` : `${selectedPlatform?.name ?? 'Platform'} aggregate`}</h2>
              <span className={`chip ${statusTone[selectedInstance?.status ?? selectedPlatform?.status] ?? 'ok'}`}>{(selectedInstance?.status ?? selectedPlatform?.status ?? 'healthy').toUpperCase()}</span>
              <span className="hint">{selectedInstance ? 'Instance detail' : 'Platform aggregate'}</span>
            </div>

            <div className="metrics">
              <div className="metric">
                <div className="m-k">CPU usage</div>
                <div className="m-v">{selectedInstance?.cpu ?? selectedPlatform?.aggregate?.cpu ?? selectedPlatform?.cpu ?? 0}<small>%</small></div>
                <div className="m-t">Compute pressure</div>
              </div>
              <div className="metric">
                <div className="m-k">Memory usage</div>
                <div className="m-v">{selectedInstance?.memory ?? selectedPlatform?.aggregate?.memory ?? selectedPlatform?.ram ?? 0}<small>%</small></div>
                <div className="m-t">Resident demand</div>
              </div>
              <div className="metric">
                <div className="m-k">Disk headroom</div>
                <div className="m-v">{selectedInstance ? selectedInstance.diskUsage : selectedPlatform?.aggregate?.diskUsage ?? 0}<small>%</small></div>
                <div className="m-t">Disk used</div>
              </div>
              <div className="metric">
                <div className="m-k">Latency</div>
                <div className="m-v">{selectedInstance?.latency ?? selectedPlatform?.aggregate?.latency ?? selectedPlatform?.latency ?? 0}<small>ms</small></div>
                <div className="m-t">Request delivery</div>
              </div>
              <div className="metric">
                <div className="m-k">Error rate</div>
                <div className="m-v">{selectedInstance?.errorRate ?? selectedPlatform?.aggregate?.errorRate ?? 0}<small>%</small></div>
                <div className="m-t">Failed requests</div>
              </div>
              <div className="metric">
                <div className="m-k">Request rate</div>
                <div className="m-v">{Math.round(selectedInstance?.requestRate ?? selectedPlatform?.aggregate?.requestRate ?? 0)}<small>/s</small></div>
                <div className="m-t">Current throughput</div>
              </div>
            </div>
            {(selectedInstance?.status ?? selectedPlatform?.status ?? 'healthy') !== 'healthy' && <div className={`reason-box ${selectedInstance?.status ?? selectedPlatform?.status ?? 'healthy'}`}>
              <strong>Health reasons</strong>
              <div className="reason-alerts">
                {(selectedInstance?.reasons ?? selectedPlatform?.reasons ?? []).filter((reason) => !reason.startsWith('All monitored')).map((reason) => {
                  const severity = reason.includes('critical') || reason.includes('offline') ? 'critical' : 'warning'
                  const reasonParts = reason.match(/^([^ ]+\-\d+)\s+(.+)$/)
                  const affectedInstance = reasonParts?.[1]
                  const message = reasonParts?.[2] ?? reason
                  return <div className={`reason-alert ${severity}`} key={reason}><span className="reason-alert-label">{severity.toUpperCase()}</span>{affectedInstance && <strong className="reason-alert-instance">{affectedInstance}</strong>}<span className="reason-alert-message">{message}</span></div>
                })}
              </div>
            </div>}
          </div>
        </section>
      )}

      {activeView === 'operations' && (
        <section className="view on" id="v-ops" role="tabpanel">
          <div className="panel">
            <div className="sec-head">
              <h2>Service operations</h2>
              <p>Searchable service and infrastructure inventory</p>
            </div>

            <div className="ops-tools">
              <input
                className="ops-search"
                value={operationsQuery}
                onChange={(event) => setOperationsQuery(event.target.value)}
                placeholder="Search service, instance, hostname, IP, OS..."
                aria-label="Search services and infrastructure"
              />
              {[
                ['platform', 'Platform', operationOptions.platforms],
                ['status', 'Status', ['up', 'deg', 'down']],
                ['health', 'Health', ['healthy', 'warning', 'critical']],
                ['datacenter', 'Data center', operationOptions.datacenters],
                ['environment', 'Environment', operationOptions.environments],
                ['os', 'OS', operationOptions.os],
              ].map(([key, label, options]) => (
                <select
                  key={key}
                  className="ops-filter"
                  value={operationsFilters[key]}
                  onChange={(event) => setOperationsFilters((current) => ({ ...current, [key]: event.target.value }))}
                  aria-label={`${label} filter`}
                >
                  <option value="">All {label}s</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ))}
              <button type="button" className="ops-clear" onClick={clearOperationFilters}>Clear filters</button>
            </div>

            <div className="ops-result-count">Showing {filteredServiceRows.length} of {serviceRows.length} instances</div>

            {filteredServiceRows.length > 0 && <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Service</th>
                  <th>Instance / Host</th>
                  <th>IP</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th className="num">CPU</th>
                  <th className="num">Mem</th>
                  <th className="num">Latency</th>
                  <th className="num">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {filteredServiceRows.map((service) => (
                  <tr
                    key={service.operationKey}
                    className="ops-row"
                    onClick={() => setSelectedOperationKey(service.operationKey)}
                  >
                    <td>
                      <div className="node">{service.platformName}</div>
                      <div className="role">{service.platformId.toUpperCase()}</div>
                    </td>
                    <td>
                      <div className="node">{service.serviceName}</div>
                      <div className="pf">{service.serviceId}</div>
                    </td>
                    <td>
                      <div className="node">{service.id}</div>
                      <div className="pf">{service.hostname}</div>
                    </td>
                    <td><span className="mono">{service.ipAddress}</span></td>
                    <td>
                      <span className={`pill ${service.serviceState === 'up' ? 'up' : service.serviceState === 'deg' ? 'deg' : 'down'}`}>
                        {service.serviceState === 'up' ? 'UP' : service.serviceState === 'deg' ? 'DEGRADED' : 'DOWN'}
                      </span>
                    </td>
                    <td><span className={`pill ${service.health === 'healthy' ? 'up' : service.health === 'warning' ? 'deg' : 'down'}`}>{service.health}</span></td>
                    <td className="right">
                      <div className="gauge">
                        <div className="track"><i style={{ width: `${service.cpu}%`, background: service.cpu > 80 ? '#d9655c' : service.cpu >= 70 ? '#e4a450' : '#1bb78d' }} /></div>
                        <span className="pc">{service.cpu}%</span>
                      </div>
                    </td>
                    <td className="right"><span className="mono">{service.memory}%</span></td>
                    <td className="right"><span className="mono">{service.latency}ms</span></td>
                    <td className="right"><span className="mono">{service.uptime}h</span></td>
                  </tr>
                ))}
              </tbody>
            </table>}
            {!filteredServiceRows.length && <div className="ops-empty"><strong>No matching services or instances</strong><span>Try another hostname, IP address, service, platform, or status.</span></div>}
          </div>

          {selectedOperation && (
            <div className="ops-detail panel">
              <div className="drill-head">
                <h2>{selectedOperation.id} / {selectedOperation.serviceName}</h2>
                <span className={`chip ${statusTone[selectedOperation.health]}`}>{selectedOperation.health.toUpperCase()}</span>
                <button type="button" className="back-btn" onClick={() => setSelectedOperationKey(null)}>Close detail</button>
              </div>
              <div className="ops-detail-grid">
                <div><h3>Infrastructure</h3><p><b>OS</b> {selectedOperation.os} {selectedOperation.osVersion}</p><p><b>Architecture</b> {selectedOperation.architecture}</p><p><b>Datacenter</b> {selectedOperation.datacenter} / {selectedOperation.region} / Zone {selectedOperation.zone}</p><p><b>Environment</b> {selectedOperation.environment}</p><p><b>Hostname</b> {selectedOperation.hostname}</p><p><b>IP address</b> {selectedOperation.ipAddress}</p></div>
                <div><h3>Performance</h3><p><b>CPU</b> {selectedOperation.cpu}%</p><p><b>Memory</b> {selectedOperation.memory}%</p><p><b>Disk used</b> {selectedOperation.diskUsage}%</p><p><b>Latency</b> {selectedOperation.latency}ms</p><p><b>Request rate</b> {selectedOperation.requestRate}/s</p><p><b>Error rate</b> {selectedOperation.errorRate}%</p><p><b>Network</b> {selectedOperation.networkThroughput} Mbps / {selectedOperation.activeConnections} connections</p></div>
                <div><h3>Availability</h3><p><b>Service</b> {selectedOperation.serviceStatus}</p><p><b>Instance health</b> {selectedOperation.health}</p><p><b>Uptime</b> {selectedOperation.uptime}h</p><p><b>Last restart</b> {formatTime(selectedOperation.lastRestart)}</p></div>
              </div>
              <div className="ops-reasons">
                <h3>Health reasons</h3>
                {(selectedOperation.reasons ?? []).filter((reason) => !reason.startsWith('All monitored')).map((reason) => {
                  const severity = reasonSeverity(reason)
                  return <div className={`reason-alert ${severity}`} key={reason}><span className="reason-alert-label">{severity.toUpperCase()}</span><strong className="reason-alert-instance">{selectedOperation.id}</strong><span className="reason-alert-message">{reasonMessage(reason, selectedOperation.id)}</span></div>
                })}
                {(!selectedOperation.reasons || selectedOperation.reasons.every((reason) => reason.startsWith('All monitored'))) && <p className="ops-healthy-reason">All monitored telemetry is within configured thresholds.</p>}
              </div>
            </div>
          )}

        </section>
      )}

      <footer>
        <div>CS-ASOP / security platform telemetry</div>
        <div>Updated {formatTime(dashboard?.updatedAt)}</div>
        <div>Connection {connectionState === 'live' ? 'stable' : 'degraded'}</div>
      </footer>
    </div>
  )
}

export default App
