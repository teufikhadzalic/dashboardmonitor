const PLATFORM_DEFINITIONS = [
  {
    id: 'iga',
    shortName: 'IGA',
    name: 'Identity Governance & Administration',
    role: 'Identity Governance',
    services: [
      { id: 'identity-sync', name: 'identity sync' },
      { id: 'entitlement-calc', name: 'entitlement calc' },
    ],
    securityMetrics: ['failedAuthentication', 'provisioningFailures', 'syncFailures', 'accessReviewCoverage'],
  },
  {
    id: 'pam',
    shortName: 'PAM',
    name: 'Privileged Access Management',
    role: 'Privileged Access',
    services: [
      { id: 'vault-rotation', name: 'vault rotation' },
      { id: 'just-in-time', name: 'just-in-time approvals' },
    ],
    securityMetrics: ['bypassAttempts', 'breakGlassSessions', 'outOfHoursAccess', 'credentialRotationFailures'],
  },
  {
    id: 'mfa',
    shortName: 'MFA',
    name: 'Multi-Factor Authentication',
    role: 'Authentication',
    services: [
      { id: 'otp-issuer', name: 'otp issuer' },
      { id: 'push-verify', name: 'push verification' },
    ],
    securityMetrics: ['authenticationAttempts', 'authenticationFailures', 'bypassAttempts', 'pushFatigueEvents'],
  },
  {
    id: 'ad-entra',
    shortName: 'AD / Entra',
    name: 'Active Directory / Entra',
    role: 'Directory Services',
    services: [
      { id: 'ldap-replication', name: 'ldap replication' },
      { id: 'group-sync', name: 'group sync' },
    ],
    securityMetrics: ['authenticationFailures', 'replicationFailures', 'groupSyncFailures', 'directoryAvailability'],
  },
  {
    id: 'sase',
    shortName: 'SASE',
    name: 'Secure Access Service Edge',
    role: 'Secure Edge',
    services: [
      { id: 'ztna-gateway', name: 'ztna gateway' },
      { id: 'proxy-policy', name: 'proxy policy' },
    ],
    securityMetrics: ['activeSessions', 'authenticationFailures', 'policyDenies', 'connectionFailures'],
  },
  {
    id: 'siem',
    shortName: 'SIEM',
    name: 'Security Information & Event Management',
    role: 'Detection & Correlation',
    services: [
      { id: 'splunkd-indexing', name: 'splunkd — indexing' },
      { id: 'rule-engine', name: 'rule engine' },
    ],
    securityMetrics: ['eventsPerSecond', 'ingestionLag', 'logSourcesOnline', 'parserFailures'],
  },
  {
    id: 'tip',
    shortName: 'TIP',
    name: 'Threat Intelligence Platform',
    role: 'Threat Intelligence',
    services: [
      { id: 'intel-ingest', name: 'intel ingest' },
      { id: 'feed-correlation', name: 'feed correlation' },
    ],
    securityMetrics: ['feedIngestionFailures', 'staleFeeds', 'indicatorCount', 'feedAvailability'],
  },
  {
    id: 'soar',
    shortName: 'SOAR',
    name: 'Security Orchestration, Automation & Response',
    role: 'Automation & Response',
    services: [
      { id: 'playbook-runner', name: 'playbook runner' },
      { id: 'ticketing-loop', name: 'ticketing loop' },
    ],
    securityMetrics: ['playbooksExecuted', 'successfulPlaybooks', 'failedPlaybooks', 'executionLatency'],
  },
  {
    id: 'ansible',
    shortName: 'Ansible',
    name: 'Ansible Automation',
    role: 'Hardening & Patch',
    services: [
      { id: 'patch-runner', name: 'patch runner' },
      { id: 'hardening-policy', name: 'hardening policy' },
    ],
    securityMetrics: ['successfulJobs', 'failedJobs', 'pendingJobs', 'patchCompliance'],
  },
];

const AGGREGATION_THRESHOLDS = {
  // Boundary values belong to the lower severity: 70 is warning, 80 is warning, and only values above 80 are critical.
  cpu: { warning: 70, critical: 80 },
  memory: { warning: 75, critical: 85 },
  latency: { warning: 100, critical: 200 },
  errorRate: { warning: 1, critical: 5 },
  diskUsage: { warning: 80, critical: 92 },
  serviceStatus: { online: 'healthy', degraded: 'warning', offline: 'critical' },
  security: {
    pamBypass: { warning: 4, critical: 6 },
    outOfHoursAccess: { warning: 20, critical: 30 },
    failedLogins: { warning: 18, critical: 30 },
    blockedThreats: { warning: 120, critical: 200 },
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((total, value) => total + Number(value || 0), 0) / values.length).toFixed(1));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function seededValue(base, variance, salt = 0) {
  const drift = ((Math.sin(salt + 1) + 1) / 2) * variance * 2 - variance;
  return clamp(base + drift, 0, 100);
}

function metricLabel(key) {
  const mapping = {
    cpu: 'CPU utilization',
    memory: 'Memory utilization',
    latency: 'Latency',
    errorRate: 'Error rate',
    diskUsage: 'Disk utilization',
  };
  return mapping[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function underlyingSeverity(metricName, value) {
  const config = AGGREGATION_THRESHOLDS[metricName];
  if (!config) return 'healthy';
  if (value > config.critical) return 'critical';
  if (value >= config.warning) return 'warning';
  return 'healthy';
}

function formatReason(metricName, value, thresholdType) {
  const label = metricLabel(metricName);
  return `${label} exceeds ${thresholdType} threshold.`;
}

function createInstanceHealthReasons(instance) {
  const reasons = [];
  const checks = [
    { metric: 'cpu', value: instance.cpu, label: 'CPU utilization' },
    { metric: 'memory', value: instance.memory, label: 'Memory utilization' },
    { metric: 'latency', value: instance.latency, label: 'Latency' },
    { metric: 'errorRate', value: instance.errorRate, label: 'Error rate' },
    { metric: 'diskUsage', value: instance.diskUsage, label: 'Disk utilization' },
  ];

  for (const check of checks) {
    const config = AGGREGATION_THRESHOLDS[check.metric];
    if (!config) continue;
    if (check.value > config.critical) {
      reasons.push(formatReason(check.metric, check.value, 'critical'));
    } else if (check.value >= config.warning) {
      reasons.push(formatReason(check.metric, check.value, 'warning'));
    }
  }

  if (instance.serviceStatus === 'offline') {
    reasons.push('Service is offline.');
  } else if (instance.serviceStatus === 'degraded') {
    reasons.push('Service is degraded.');
  }

  return reasons.length ? reasons : ['All monitored telemetry is within configured thresholds'];
}

function evaluateInstanceHealth(instance) {
  const reasons = createInstanceHealthReasons(instance);
  const severities = [];

  for (const [metricName, config] of Object.entries(AGGREGATION_THRESHOLDS)) {
    if (metricName === 'serviceStatus' || metricName === 'security') continue;
    if (typeof instance[metricName] === 'number') {
      severities.push(underlyingSeverity(metricName, instance[metricName]));
    }
  }

  if (instance.serviceStatus === 'offline') severities.push('critical');
  else if (instance.serviceStatus === 'degraded') severities.push('warning');

  const status = severities.includes('critical') ? 'critical' : severities.includes('warning') ? 'warning' : 'healthy';

  return {
    status,
    reasons,
  };
}

function generateInstanceTelemetry(platform, index, previousInstance = null, tick = 0) {
  const salt = tick * 17 + index * 11 + platform.id.length * 3;
  const serviceStatusSeed = previousInstance?.serviceStatus || 'online';
  const serviceStatus = serviceStatusSeed === 'offline' && (index + tick) % 9 === 0 ? 'online' : 'online';

  const baseCpu = platform.id === 'siem' ? 63 : platform.id === 'pam' ? 58 : platform.id === 'soar' ? 61 : 48;
  const baseMemory = platform.id === 'ad-entra' ? 62 : platform.id === 'sase' ? 60 : 55;
  const baseLatency = platform.id === 'siem' ? 82 : platform.id === 'mfa' ? 29 : 46;

  const cpu = clamp(
    previousInstance?.cpu !== undefined ? previousInstance.cpu + (Math.sin(salt) * 8) : seededValue(baseCpu, 18, salt),
    12,
    98,
  );
  const memory = clamp(
    previousInstance?.memory !== undefined ? previousInstance.memory + (Math.cos(salt + 1) * 7) : seededValue(baseMemory, 16, salt + 7),
    10,
    96,
  );
  const latency = clamp(
    previousInstance?.latency !== undefined ? previousInstance.latency + (Math.sin(salt + 2) * 15) : seededValue(baseLatency, 28, salt + 13),
    10,
    260,
  );
  const diskUsage = clamp(
    previousInstance?.diskUsage !== undefined ? previousInstance.diskUsage + (Math.sin(salt + 3) * 4) : seededValue(55, 18, salt + 19),
    20,
    96,
  );
  const errorRate = clamp(
    previousInstance?.errorRate !== undefined ? previousInstance.errorRate + (Math.cos(salt + 4) * 0.35) : seededValue(0.8, 1.6, salt + 23),
    0,
    8,
  );
  const uptime = Number((previousInstance?.uptime !== undefined ? previousInstance.uptime + 0.1 : 18 + (index % 9) * 2.1).toFixed(1));
  const requestRate = clamp(
    previousInstance?.requestRate !== undefined ? previousInstance.requestRate + (Math.sin(salt + 5) * 170) : 500 + index * 180,
    40,
    5400,
  );
  const activeConnections = Math.round(clamp(
    previousInstance?.activeConnections !== undefined
      ? previousInstance.activeConnections + Math.sin(salt + 6) * 12
      : 80 + index * 24 + Math.abs(Math.round(Math.sin(salt + 8) * 70)),
    24,
    920,
  ));
  const networkThroughput = Number(clamp(
    previousInstance?.networkThroughput !== undefined
      ? previousInstance.networkThroughput + Math.cos(salt + 9) * 6
      : 38 + Math.abs(Math.sin(salt + 10) * 48),
    10,
    980,
  ).toFixed(1));
  const location = index % 3;
  const locations = [
    { datacenter: 'DC-JKT-01', region: 'Jakarta', zone: 'A' },
    { datacenter: 'DC-JKT-02', region: 'Jakarta', zone: 'B' },
    { datacenter: 'DC-SBY-01', region: 'Surabaya', zone: 'A' },
  ];
  const locationDetails = locations[location];
  const platformCode = platform.shortName.replace(/[^A-Z0-9]/gi, '').toLowerCase();
  const osDetails = index % 4 === 0
    ? { os: 'Red Hat Enterprise Linux', osVersion: '9.4', architecture: 'x86_64' }
    : { os: 'Ubuntu', osVersion: '22.04 LTS', architecture: 'x86_64' };

  const metrics = {
    failedAuthentication: Math.max(0, Math.round(seededValue(12, 18, salt + 31))),
    provisioningFailures: Math.max(0, Math.round(seededValue(3, 6, salt + 37))),
    syncFailures: Math.max(0, Math.round(seededValue(2, 5, salt + 41))),
    accessReviewCoverage: Math.max(80, Math.round(seededValue(96, 8, salt + 43))),
    bypassAttempts: Math.max(0, Math.round(seededValue(2, 5, salt + 47))),
    breakGlassSessions: Math.max(0, Math.round(seededValue(1, 3, salt + 53))),
    outOfHoursAccess: Math.max(0, Math.round(seededValue(8, 16, salt + 59))),
    credentialRotationFailures: Math.max(0, Math.round(seededValue(2, 6, salt + 61))),
    authenticationAttempts: Math.max(0, Math.round(seededValue(2000, 1200, salt + 67))),
    authenticationFailures: Math.max(0, Math.round(seededValue(18, 26, salt + 71))),
    pushFatigueEvents: Math.max(0, Math.round(seededValue(1, 4, salt + 73))),
    replicationFailures: Math.max(0, Math.round(seededValue(1, 5, salt + 79))),
    groupSyncFailures: Math.max(0, Math.round(seededValue(2, 5, salt + 83))),
    directoryAvailability: Math.max(90, Math.round(seededValue(97, 6, salt + 89))),
    activeSessions: Math.max(0, Math.round(seededValue(400, 350, salt + 97))),
    policyDenies: Math.max(0, Math.round(seededValue(18, 35, salt + 101))),
    connectionFailures: Math.max(0, Math.round(seededValue(3, 8, salt + 107))),
    eventsPerSecond: Math.max(0, Math.round(seededValue(26000, 18000, salt + 113))),
    ingestionLag: Math.max(0, Math.round(seededValue(45, 35, salt + 127))),
    logSourcesOnline: Math.max(90, Math.round(seededValue(98, 6, salt + 131))),
    parserFailures: Math.max(0, Math.round(seededValue(1, 6, salt + 137))),
    feedIngestionFailures: Math.max(0, Math.round(seededValue(2, 4, salt + 139))),
    staleFeeds: Math.max(0, Math.round(seededValue(0, 2, salt + 149))),
    indicatorCount: Math.max(0, Math.round(seededValue(4000, 2400, salt + 151))),
    feedAvailability: Math.max(90, Math.round(seededValue(96, 6, salt + 157))),
    playbooksExecuted: Math.max(0, Math.round(seededValue(18, 15, salt + 163))),
    successfulPlaybooks: Math.max(0, Math.round(seededValue(90, 10, salt + 167))),
    failedPlaybooks: Math.max(0, Math.round(seededValue(2, 5, salt + 173))),
    executionLatency: Math.max(0, Math.round(seededValue(45, 40, salt + 179))),
    successfulJobs: Math.max(0, Math.round(seededValue(92, 9, salt + 181))),
    failedJobs: Math.max(0, Math.round(seededValue(2, 6, salt + 191))),
    pendingJobs: Math.max(0, Math.round(seededValue(2, 8, salt + 193))),
    patchCompliance: Math.max(90, Math.round(seededValue(96, 6, salt + 197))),
  };

  const platformRiskShift = (index + tick) % 10;
  if (platformRiskShift === 2) {
    metrics.bypassAttempts += 5;
    metrics.outOfHoursAccess += 12;
  }
  if (platformRiskShift === 6) {
    metrics.parserFailures += 4;
    metrics.ingestionLag += 26;
  }
  if (platformRiskShift === 8) {
    metrics.failedJobs += 4;
    metrics.pendingJobs += 6;
  }

  const instance = {
    id: `${platform.shortName.replace(/[^A-Z0-9]/gi, '').toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
    platform: platform.shortName,
    hostname: `${platformCode}-prod-${String(index + 1).padStart(2, '0')}`,
    ipAddress: `10.20.${platform.id.length}.${index + 10}`,
    ...osDetails,
    ...locationDetails,
    environment: index === 9 ? 'Staging' : 'Production',
    cpu: Number(cpu.toFixed(1)),
    memory: Number(memory.toFixed(1)),
    diskUsage: Number(diskUsage.toFixed(1)),
    latency: Number(latency.toFixed(1)),
    errorRate: Number(errorRate.toFixed(1)),
    uptime: Number(uptime.toFixed(1)),
    requestRate: Math.round(requestRate),
    activeConnections,
    networkThroughput,
    lastRestart: new Date(Date.now() - (uptime * 60 * 60 * 1000)).toISOString(),
    serviceStatus,
    metrics,
  };

  const health = evaluateInstanceHealth(instance);
  return {
    ...instance,
    status: health.status,
    reasons: health.reasons,
  };
}

function buildPlatformSecurityValues(platformId, instances) {
  const metrics = {};

  switch (platformId) {
    case 'iga':
      metrics.failedAuthentication = sum(instances.map((instance) => instance.metrics.failedAuthentication || 0));
      metrics.provisioningFailures = sum(instances.map((instance) => instance.metrics.provisioningFailures || 0));
      metrics.syncFailures = sum(instances.map((instance) => instance.metrics.syncFailures || 0));
      metrics.accessReviewCoverage = Math.round(average(instances.map((instance) => instance.metrics.accessReviewCoverage || 100)));
      break;
    case 'pam':
      metrics.sessionsBypassingPAM = sum(instances.map((instance) => instance.metrics.bypassAttempts || 0));
      metrics.outOfHoursAccess = sum(instances.map((instance) => instance.metrics.outOfHoursAccess || 0));
      metrics.breakGlassSessions = sum(instances.map((instance) => instance.metrics.breakGlassSessions || 0));
      metrics.credentialRotationFailures = sum(instances.map((instance) => instance.metrics.credentialRotationFailures || 0));
      break;
    case 'mfa':
      metrics.authenticationAttempts = sum(instances.map((instance) => instance.metrics.authenticationAttempts || 0));
      metrics.authenticationFailures = sum(instances.map((instance) => instance.metrics.authenticationFailures || 0));
      metrics.bypassAttempts = sum(instances.map((instance) => instance.metrics.bypassAttempts || 0));
      metrics.pushFatigueEvents = sum(instances.map((instance) => instance.metrics.pushFatigueEvents || 0));
      break;
    case 'ad-entra':
      metrics.authenticationFailures = sum(instances.map((instance) => instance.metrics.authenticationFailures || 0));
      metrics.replicationFailures = sum(instances.map((instance) => instance.metrics.replicationFailures || 0));
      metrics.groupSyncFailures = sum(instances.map((instance) => instance.metrics.groupSyncFailures || 0));
      metrics.directoryAvailability = Math.round(average(instances.map((instance) => instance.metrics.directoryAvailability || 100)));
      break;
    case 'sase':
      metrics.activeSessions = sum(instances.map((instance) => instance.metrics.activeSessions || 0));
      metrics.authenticationFailures = sum(instances.map((instance) => instance.metrics.authenticationFailures || 0));
      metrics.policyDenies = sum(instances.map((instance) => instance.metrics.policyDenies || 0));
      metrics.connectionFailures = sum(instances.map((instance) => instance.metrics.connectionFailures || 0));
      break;
    case 'siem':
      metrics.eventsPerSecond = Math.round(average(instances.map((instance) => instance.metrics.eventsPerSecond || 0)));
      metrics.ingestionLag = Math.round(average(instances.map((instance) => instance.metrics.ingestionLag || 0)));
      metrics.logSourcesOnline = Math.round(average(instances.map((instance) => instance.metrics.logSourcesOnline || 100)));
      metrics.parserFailures = sum(instances.map((instance) => instance.metrics.parserFailures || 0));
      break;
    case 'tip':
      metrics.feedIngestionFailures = sum(instances.map((instance) => instance.metrics.feedIngestionFailures || 0));
      metrics.staleFeeds = sum(instances.map((instance) => instance.metrics.staleFeeds || 0));
      metrics.indicatorCount = sum(instances.map((instance) => instance.metrics.indicatorCount || 0));
      metrics.feedAvailability = Math.round(average(instances.map((instance) => instance.metrics.feedAvailability || 100)));
      break;
    case 'soar':
      metrics.playbooksExecuted = sum(instances.map((instance) => instance.metrics.playbooksExecuted || 0));
      metrics.successfulPlaybooks = sum(instances.map((instance) => instance.metrics.successfulPlaybooks || 0));
      metrics.failedPlaybooks = sum(instances.map((instance) => instance.metrics.failedPlaybooks || 0));
      metrics.executionLatency = Math.round(average(instances.map((instance) => instance.metrics.executionLatency || 0)));
      break;
    case 'ansible':
      metrics.successfulJobs = sum(instances.map((instance) => instance.metrics.successfulJobs || 0));
      metrics.failedJobs = sum(instances.map((instance) => instance.metrics.failedJobs || 0));
      metrics.pendingJobs = sum(instances.map((instance) => instance.metrics.pendingJobs || 0));
      metrics.patchCompliance = Math.round(average(instances.map((instance) => instance.metrics.patchCompliance || 100)));
      break;
    default:
      break;
  }

  return metrics;
}

function evaluatePlatformHealth(platform) {
  const instances = platform.instances || [];
  const evaluatedInstances = instances.map((instance) => ({
    ...instance,
    ...evaluateInstanceHealth(instance),
  }));
  const healthyInstances = evaluatedInstances.filter((instance) => instance.status === 'healthy').length;
  const warningInstances = evaluatedInstances.filter((instance) => instance.status === 'warning').length;
  const criticalInstances = evaluatedInstances.filter((instance) => instance.status === 'critical').length;

  const problematicInstances = evaluatedInstances.filter((instance) => instance.status !== 'healthy');
  const instanceReasons = problematicInstances.flatMap((instance) =>
    (instance.reasons || [])
      .filter((reason) => !reason.startsWith('All monitored'))
      .map((reason) => `${instance.id} ${reason}`),
  );
  const criticalReasons = instanceReasons.filter((reason) => reason.includes('critical threshold') || reason.includes('offline'));
  const warningReasons = instanceReasons.filter((reason) => !criticalReasons.includes(reason));

  const status = criticalInstances > 0 ? 'critical' : warningInstances > 0 ? 'warning' : 'healthy';
  const reasons = instanceReasons.length
    ? [...criticalReasons, ...warningReasons]
    : ['All monitored instances are within configured thresholds'];

  const aggregate = {
    healthyInstances,
    warningInstances,
    criticalInstances,
    totalInstances: instances.length,
    cpu: Number(average(evaluatedInstances.map((instance) => instance.cpu)).toFixed(1)),
    memory: Number(average(evaluatedInstances.map((instance) => instance.memory)).toFixed(1)),
    latency: Number(average(evaluatedInstances.map((instance) => instance.latency)).toFixed(1)),
    errorRate: Number(average(evaluatedInstances.map((instance) => instance.errorRate)).toFixed(1)),
    diskUsage: Number(average(evaluatedInstances.map((instance) => instance.diskUsage)).toFixed(1)),
    requestRate: Math.round(average(evaluatedInstances.map((instance) => instance.requestRate))),
  };

  return {
    aggregate,
    status,
    nodeStatus: status === 'healthy' ? 'online' : status === 'warning' ? 'warning' : 'critical',
    reasons,
  };
}

function evaluateServiceHealth(service, serviceIndex, platformId) {
  const cpu = Number(service.cpu || 35);
  const memory = Number(service.memory || 25);
  const baseStatus = cpu >= 75 || memory >= 85 ? 'down' : cpu >= 55 || memory >= 70 ? 'deg' : 'up';

  return {
    ...service,
    status: baseStatus,
    cpu: clamp(cpu, 10, 96),
    memory: clamp(memory, 10, 90),
    uptime: Number((service.uptime || 24).toFixed(1)),
  };
}

function buildDashboardSecurity(platforms) {
  const pamPlatform = platforms.find((platform) => platform.id === 'pam');
  const adPlatform = platforms.find((platform) => platform.id === 'ad-entra');
  const sasePlatform = platforms.find((platform) => platform.id === 'sase');

  return {
    sessionsBypassingPAM: pamPlatform?.security?.sessionsBypassingPAM ?? 0,
    outOfHoursAccess: pamPlatform?.security?.outOfHoursAccess ?? 0,
    failedLogins: adPlatform?.security?.authenticationFailures ?? 0,
    blockedThreats: sasePlatform?.security?.policyDenies ?? 0,
    exposure: [
      {
        type: 'pam_bypass',
        count: pamPlatform?.security?.sessionsBypassingPAM ?? 0,
        severity: 'high',
        platform: 'PAM',
      },
      {
        type: 'out_of_hours_access',
        count: pamPlatform?.security?.outOfHoursAccess ?? 0,
        severity: 'medium',
        platform: 'PAM',
      },
      {
        type: 'failed_logins',
        count: adPlatform?.security?.authenticationFailures ?? 0,
        severity: 'medium',
        platform: 'AD / Entra',
      },
      {
        type: 'blocked_threats',
        count: sasePlatform?.security?.policyDenies ?? 0,
        severity: 'high',
        platform: 'SASE',
      },
    ],
  };
}

function buildDashboardSummary(platforms, security) {
  const criticalNodes = platforms.filter((platform) => platform.status === 'critical').length;
  const warningNodes = platforms.filter((platform) => platform.status === 'warning').length;
  const onlineNodes = platforms.filter((platform) => platform.status === 'healthy').length;

  const overallHealth = criticalNodes > 0 ? 'critical' : warningNodes > 0 ? 'warning' : 'healthy';

  return {
    overallHealth,
    onlineNodes,
    warningNodes,
    criticalNodes,
    totalPlatforms: platforms.length,
    healthyPlatforms: onlineNodes,
    warningPlatforms: warningNodes,
    criticalPlatforms: criticalNodes,
    totalInstances: platforms.reduce((total, platform) => total + platform.instances.length, 0),
    healthyInstances: platforms.reduce((total, platform) => total + platform.aggregate.healthyInstances, 0),
    warningInstances: platforms.reduce((total, platform) => total + platform.aggregate.warningInstances, 0),
    criticalInstances: platforms.reduce((total, platform) => total + platform.aggregate.criticalInstances, 0),
  };
}

function createDashboardState(previousDashboard = { platforms: [] }, tick = 0) {
  const platforms = PLATFORM_DEFINITIONS.map((platformDefinition, platformIndex) => {
    const previousPlatform = previousDashboard.platforms?.find((platform) => platform.id === platformDefinition.id);
    const previousInstances = previousPlatform?.instances || [];
    const instances = Array.from({ length: 10 }, (_, index) => {
      const previousInstance = previousInstances[index] || null;
      const base = generateInstanceTelemetry(platformDefinition, index, previousInstance, tick + platformIndex);

      if (platformIndex === 0 && index === 2) {
        base.cpu = 91;
        base.memory = 82;
        base.latency = 75;
        base.errorRate = 0.8;
        base.serviceStatus = 'online';
      }
      if (platformIndex === 0 && index === 1) {
        base.cpu = 76;
        base.memory = 61;
        base.latency = 43;
        base.errorRate = 0.4;
        base.serviceStatus = 'online';
      }
      if (platformIndex === 1 && index === 3) {
        base.cpu = 92;
        base.memory = 60;
        base.serviceStatus = 'offline';
        base.metrics.bypassAttempts = 12;
      }
      if (platformIndex === 5 && index === 4) {
        base.cpu = 70;
        base.memory = 58;
        base.latency = 150;
        base.metrics.parserFailures = 7;
      }
      if (platformIndex === 7 && index === 6) {
        base.cpu = 95;
        base.memory = 68;
        base.metrics.failedPlaybooks = 6;
      }

      const health = evaluateInstanceHealth(base);
      return { ...base, status: health.status, reasons: health.reasons };
    });

    const services = (platformDefinition.services || []).map((service, index) => {
      const sourceInstance = instances[index === 0 ? 0 : 1];
      const serviceObject = evaluateServiceHealth({
        id: service.id,
        name: service.name,
        instanceId: sourceInstance.id,
        status: 'up',
        cpu: sourceInstance.cpu,
        memory: sourceInstance.memory,
        uptime: sourceInstance.uptime,
      }, index, platformDefinition.id);
      serviceObject.status = sourceInstance.serviceStatus === 'offline'
        ? 'down'
        : sourceInstance.serviceStatus === 'degraded' || sourceInstance.status === 'warning'
          ? 'deg'
          : 'up';
      return serviceObject;
    });

    const aggregateSummary = evaluatePlatformHealth({ instances });
    const securityMetrics = buildPlatformSecurityValues(platformDefinition.id, instances);

    const platform = {
      id: platformDefinition.id,
      shortName: platformDefinition.shortName,
      name: platformDefinition.name,
      role: platformDefinition.role,
      nodeStatus: aggregateSummary.nodeStatus,
      status: aggregateSummary.status,
      cpu: aggregateSummary.aggregate.cpu,
      ram: aggregateSummary.aggregate.memory,
      latency: aggregateSummary.aggregate.latency,
      diskAvailableDays: clamp(Math.round(90 - aggregateSummary.aggregate.diskUsage), 12, 90),
      instances,
      aggregate: {
        ...aggregateSummary.aggregate,
        healthyInstances: aggregateSummary.aggregate.healthyInstances,
        warningInstances: aggregateSummary.aggregate.warningInstances,
        criticalInstances: aggregateSummary.aggregate.criticalInstances,
        totalInstances: aggregateSummary.aggregate.totalInstances,
      },
      reasons: aggregateSummary.reasons,
      services,
      security: securityMetrics,
    };

    return platform;
  });

  const security = buildDashboardSecurity(platforms);
  const summary = buildDashboardSummary(platforms, security);

  const dashboardState = {
    name: 'cs-asop-platform-baseline',
    platforms,
    security,
    summary,
    updatedAt: new Date().toISOString(),
  };

  return dashboardState;
}

module.exports = {
  AGGREGATION_THRESHOLDS,
  PLATFORM_DEFINITIONS,
  createDashboardState,
  evaluateInstanceHealth,
  evaluatePlatformHealth,
  buildDashboardSecurity,
  buildDashboardSummary,
  generateInstanceTelemetry,
  evaluateServiceHealth,
};
