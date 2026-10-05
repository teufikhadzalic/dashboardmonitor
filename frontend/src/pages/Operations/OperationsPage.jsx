import { Fragment, useMemo, useState } from 'react'
import { formatTime } from '../../utils/formatTime.js'
import { buildServiceRows, filterServiceRows, getOperationOptions } from '../../utils/operations.js'

export default function OperationsPage({ platforms }) {
  const [operationsQuery, setOperationsQuery] = useState('')
  const [operationsFilters, setOperationsFilters] = useState({ platform: '', status: '', health: '', datacenter: '', environment: '', os: '' })
  const [selectedOperationKey, setSelectedOperationKey] = useState(null)
  const serviceRows = useMemo(() => buildServiceRows(platforms), [platforms])
  const operationOptions = useMemo(() => getOperationOptions(serviceRows), [serviceRows])
  const filteredServiceRows = useMemo(
    () => filterServiceRows(serviceRows, operationsQuery, operationsFilters),
    [operationsFilters, operationsQuery, serviceRows],
  )

  const clearOperationFilters = () => {
    setOperationsQuery('')
    setOperationsFilters({ platform: '', status: '', health: '', datacenter: '', environment: '', os: '' })
  }

  return (

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
                ['status', 'Status', ['up', 'down']],
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
                {filteredServiceRows.map((service) => {
                  const expanded = selectedOperationKey === service.operationKey
                  return <Fragment key={service.operationKey}>
                  <tr
                    className={`ops-row ${expanded ? 'expanded' : ''}`}
                    onClick={() => setSelectedOperationKey(expanded ? null : service.operationKey)}
                    aria-expanded={expanded}
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
                      <span className={`pill ${service.serviceState === 'up' ? 'up' : 'down'}`}>
                        {service.serviceState.toUpperCase()}
                      </span>
                    </td>
                    <td><span className={`pill ${service.health === 'healthy' ? 'up' : service.health === 'warning' ? 'watch' : 'down'}`}>{service.health}</span></td>
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
                  {expanded && <tr className="ops-expanded-row"><td colSpan="10">
                    <div className="ops-inline-detail">
                      <div className="inline-detail-head"><strong>{service.serviceName}</strong><span>{service.platformName} / {service.id}</span><button type="button" className="back-btn" onClick={() => setSelectedOperationKey(null)}>Close</button></div>
                      <div className="inline-detail-grid">
                        <div><h3>Availability</h3><p><b>Status</b><span className={`pill ${service.serviceState === 'up' ? 'up' : 'down'}`}>{service.serviceState.toUpperCase()}</span></p><p><b>Status reason</b>{service.serviceStatusReason}</p><p><b>Check</b>{service.availabilityCheck}</p><p><b>Health</b><span className={`pill ${service.health === 'healthy' ? 'up' : service.health === 'warning' ? 'watch' : 'down'}`}>{service.health.toUpperCase()}</span></p></div>
                        <div><h3>Performance</h3><p><b>CPU</b>{service.cpu}%</p><p><b>Memory</b>{service.memory}%</p><p><b>Latency</b>{service.latency}ms</p><p><b>Error rate</b>{service.errorRate}%</p><p><b>Disk</b>{service.diskUsage}%</p><p><b>Request rate</b>{service.requestRate}/s</p></div>
                        <div><h3>Infrastructure</h3><p><b>Hostname</b>{service.hostname}</p><p><b>IP address</b>{service.ipAddress}</p><p><b>OS</b>{service.os} {service.osVersion}</p><p><b>Datacenter</b>{service.datacenter} / {service.region} / Zone {service.zone}</p><p><b>Environment</b>{service.environment}</p><p><b>Uptime</b>{service.uptime}h</p><p><b>Last restart</b>{formatTime(service.lastRestart)}</p></div>
                      </div>
                    </div>
                  </td></tr>}
                  </Fragment>
                })}
              </tbody>
            </table>}
            {!filteredServiceRows.length && <div className="ops-empty"><strong>No matching services or instances</strong><span>Try another hostname, IP address, service, platform, or status.</span></div>}
          </div>

        </section>
  )
}
