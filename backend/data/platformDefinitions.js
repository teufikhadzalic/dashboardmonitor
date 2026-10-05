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

module.exports = { PLATFORM_DEFINITIONS };
