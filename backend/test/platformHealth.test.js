const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateInstanceHealth,
  evaluatePlatformHealth,
  createDashboardState,
  AGGREGATION_THRESHOLDS,
} = require('../utils/platformHealth');

test('healthy telemetry stays healthy', () => {
  const instance = {
    cpu: 58,
    memory: 67,
    latency: 50,
    errorRate: 0.5,
    diskUsage: 60,
    serviceStatus: 'online',
    metrics: {},
  };

  const result = evaluateInstanceHealth(instance);
  assert.equal(result.status, 'healthy');
  assert.deepEqual(result.reasons, ['All monitored telemetry is within configured thresholds']);
});

test('warning thresholds do not upgrade to critical without a critical metric', () => {
  const warning = evaluateInstanceHealth({
    cpu: 75,
    memory: 60,
    latency: 50,
    errorRate: 0.5,
    diskUsage: 60,
    serviceStatus: 'online',
    metrics: {},
  });
  assert.equal(warning.status, 'warning');
  assert.match(warning.reasons[0], /CPU.*warning/);

  const latencyOnly = evaluateInstanceHealth({
    cpu: 58,
    memory: 67,
    latency: 150,
    errorRate: 0.5,
    diskUsage: 60,
    serviceStatus: 'online',
    metrics: {},
  });
  assert.equal(latencyOnly.status, 'warning');
  assert.match(latencyOnly.reasons[0], /Latency.*warning/);

  const critical = evaluateInstanceHealth({
    cpu: 92,
    memory: 60,
    latency: 50,
    errorRate: 0.5,
    diskUsage: 60,
    serviceStatus: 'online',
    metrics: {},
  });
  assert.equal(critical.status, 'critical');
  assert.match(critical.reasons[0], /CPU.*critical/);
});

test('prototype threshold boundaries are consistent', () => {
  const atWarningBoundary = evaluateInstanceHealth({ cpu: 70, memory: 75, latency: 100, errorRate: 1, serviceStatus: 'online' });
  assert.equal(atWarningBoundary.status, 'warning');

  const atCriticalBoundary = evaluateInstanceHealth({ cpu: 80, memory: 85, latency: 200, errorRate: 5, serviceStatus: 'online' });
  assert.equal(atCriticalBoundary.status, 'warning');

  const aboveCriticalBoundary = evaluateInstanceHealth({ cpu: 80.1, memory: 85.1, latency: 200.1, errorRate: 5.1, serviceStatus: 'online' });
  assert.equal(aboveCriticalBoundary.status, 'critical');
});

test('platform health is derived from instance health and not average metrics alone', () => {
  const instances = Array.from({ length: 10 }, (_, index) => ({
    id: `SOAR-${String(index + 1).padStart(2, '0')}`,
    status: index === 6 ? 'critical' : 'healthy',
    cpu: index === 6 ? 95 : 52,
    memory: 60,
    latency: 50,
    errorRate: 0.5,
    diskUsage: 60,
    serviceStatus: 'online',
    metrics: {},
    reasons: index === 6 ? ['SOAR-07 CPU utilization exceeds critical threshold.'] : ['All monitored telemetry is within configured thresholds'],
  }));

  const platform = evaluatePlatformHealth({
    id: 'soar',
    shortName: 'SOAR',
    name: 'Security Orchestration, Automation & Response',
    role: 'Automation & Response',
    instances,
  });

  assert.equal(platform.status, 'critical');
  assert.equal(platform.aggregate.cpu < 60, true);
  assert.match(platform.reasons[0], /SOAR-07.*critical/);
  assert.equal(platform.aggregate.healthyInstances, 9);
  assert.equal(platform.aggregate.warningInstances, 0);
  assert.equal(platform.aggregate.criticalInstances, 1);
});

test('critical platform reasons identify critical conditions first', () => {
  const platform = evaluatePlatformHealth({
    instances: [
      { id: 'PAM-01', cpu: 75, memory: 60, latency: 50, errorRate: 0.2, diskUsage: 60, serviceStatus: 'online' },
      { id: 'PAM-02', cpu: 92, memory: 60, latency: 50, errorRate: 0.2, diskUsage: 60, serviceStatus: 'online' },
    ],
  });

  assert.equal(platform.status, 'critical');
  assert.equal(platform.aggregate.criticalInstances, 1);
  assert.match(platform.reasons[0], /PAM-02.*critical/);
  assert.ok(platform.reasons.some((reason) => /critical/.test(reason)));
});

test('dashboard state creates nine platforms with ten instances each', () => {
  const dashboard = createDashboardState();
  assert.equal(dashboard.platforms.length, 9);
  assert.ok(dashboard.platforms.every((platform) => platform.instances.length === 10));
  assert.ok(['healthy', 'warning', 'critical'].includes(dashboard.summary.overallHealth));
  assert.ok(Number.isInteger(dashboard.summary.onlineNodes));
  assert.ok(Number.isInteger(dashboard.summary.warningNodes));
  assert.ok(Number.isInteger(dashboard.summary.criticalNodes));
  assert.ok(dashboard.security.sessionsBypassingPAM >= 0);
  assert.ok(dashboard.security.failedLogins >= 0);
  assert.equal(dashboard.summary.totalPlatforms, 9);
  assert.equal(dashboard.summary.totalInstances, 90);
  assert.ok(dashboard.platforms.every((platform) => platform.instances.every((instance) => instance.hostname && instance.ipAddress && instance.os && instance.datacenter && instance.environment)));
  assert.equal(
    dashboard.summary.healthyInstances + dashboard.summary.warningInstances + dashboard.summary.criticalInstances,
    90,
  );
  assert.equal(
    dashboard.security.sessionsBypassingPAM,
    dashboard.platforms.find((platform) => platform.id === 'pam').security.sessionsBypassingPAM,
  );
  assert.equal(
    dashboard.security.failedLogins,
    dashboard.platforms.find((platform) => platform.id === 'ad-entra').security.authenticationFailures,
  );
  assert.equal(
    dashboard.security.blockedThreats,
    dashboard.platforms.find((platform) => platform.id === 'sase').security.policyDenies,
  );
  assert.deepEqual(
    dashboard.security.exposure.map((entry) => entry.platform),
    ['PAM', 'PAM', 'AD / Entra', 'SASE'],
  );
});

test('service status follows its source instance condition', () => {
  const dashboard = createDashboardState();
  const pam = dashboard.platforms.find((platform) => platform.id === 'pam');
  const sourceInstance = pam.instances[0];
  const service = pam.services[0];

  assert.equal(service.cpu, sourceInstance.cpu);
  assert.equal(service.memory, sourceInstance.memory);
  assert.equal(service.uptime, sourceInstance.uptime);
  assert.equal(service.status, sourceInstance.status === 'healthy' ? 'up' : 'deg');
});

test('health thresholds are centralized in one config object', () => {
  assert.ok(AGGREGATION_THRESHOLDS.cpu.warning >= 70);
  assert.ok(AGGREGATION_THRESHOLDS.latency.critical > AGGREGATION_THRESHOLDS.latency.warning);
  assert.ok(AGGREGATION_THRESHOLDS.errorRate.warning < AGGREGATION_THRESHOLDS.errorRate.critical);
});
