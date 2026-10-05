import { useMemo, useState } from 'react'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const statusTone = {
  healthy: 'ok',
  warning: 'watch',
  critical: 'exposed',
  up: 'ok',
  down: 'exposed',
}

const EMPTY_PLATFORMS = []
const EMPTY_SECURITY = { sessionsBypassingPAM: 0, outOfHoursAccess: 0, failedLogins: 0, blockedThreats: 0 }
const EMPTY_SUMMARY = { overallHealth: 'healthy', onlineNodes: 0, warningNodes: 0, criticalNodes: 0 }

export default function AssurancePage({ dashboard }) {
  const platforms = dashboard?.platforms ?? EMPTY_PLATFORMS
  const security = dashboard?.security ?? EMPTY_SECURITY
  const summary = dashboard?.summary ?? EMPTY_SUMMARY
  const [selectedPlatformId, setSelectedPlatformId] = useState(null)
  const [graphPlatformId, setGraphPlatformId] = useState(null)
  const [selectedInstanceId, setSelectedInstanceId] = useState(null)

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

  return (
    <>

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
              <div className="t-telemetry">Availability {platform.aggregate?.upInstances ?? 0}/{platform.instances?.length ?? 0} UP</div>
              <div className="t-reason">{platform.reasons?.[0] ?? 'All monitored telemetry is within thresholds'}</div>
            </button>
          )
        })}
      </div>

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
                  const severity = reason.includes('critical') || reason.includes('unavailable') || reason.includes('down') ? 'critical' : 'warning'
                  const reasonParts = reason.match(/^([^ ]+-\d+)\s+(.+)$/)
                  const affectedInstance = reasonParts?.[1]
                  const message = reasonParts?.[2] ?? reason
                  return <div className={`reason-alert ${severity}`} key={reason}><span className="reason-alert-label">{severity.toUpperCase()}</span>{affectedInstance && <strong className="reason-alert-instance">{affectedInstance}</strong>}<span className="reason-alert-message">{message}</span></div>
                })}
              </div>
            </div>}
          </div>
        </section>
    </>
  )
}
