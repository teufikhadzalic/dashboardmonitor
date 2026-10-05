export function buildServiceRows(platforms) {
  return platforms.flatMap((platform) =>
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
        serviceStatus: instance.serviceStatus ?? service.status ?? 'up',
        serviceStatusReason: instance.serviceStatusReason ?? service.statusReason ?? 'HTTP health check successful',
        availabilityCheck: instance.availabilityCheck ?? service.checkType ?? 'HTTP health check',
        serviceState: instance.serviceStatus ?? service.status ?? 'up',
        health: instance.status ?? platform.status,
        operationKey: `${platform.id}-${instance.id}-${service.id}`,
      }]
    }),
  )
}

export function getOperationOptions(serviceRows) {
  return {
    platforms: [...new Set(serviceRows.map((row) => row.platform))].filter(Boolean),
    datacenters: [...new Set(serviceRows.map((row) => row.datacenter))].filter(Boolean),
    environments: [...new Set(serviceRows.map((row) => row.environment))].filter(Boolean),
    os: [...new Set(serviceRows.map((row) => row.os))].filter(Boolean),
  }
}

export function filterServiceRows(serviceRows, query, filters) {
  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  const normalizedQuery = normalize(query)

  return serviceRows.filter((row) => {
    const searchable = normalize([
      row.serviceName,
      row.serviceId,
      row.platform,
      row.platformName,
      row.id,
      row.hostname,
      row.ipAddress,
      row.os,
      row.osVersion,
      row.datacenter,
      row.region,
      row.environment,
      row.serviceStatus,
      row.serviceState,
      row.health,
    ].filter(Boolean).join(' '))
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
    const matches = (key, value) => !value || normalize(row[key]) === normalize(value)

    return matchesQuery
      && matches('platform', filters.platform)
      && matches('serviceState', filters.status)
      && matches('health', filters.health)
      && matches('datacenter', filters.datacenter)
      && matches('environment', filters.environment)
      && matches('os', filters.os)
  })
}
