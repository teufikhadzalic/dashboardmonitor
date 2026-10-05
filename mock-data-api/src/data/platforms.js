const platforms = [
  {
    id: "iga",
    name: "Identity Governance & Administration",
    shortName: "IGA",
    cpuBaseline: 48,
    memoryBaseline: 55,
    availabilityBaseline: 99.95,
  },
  {
    id: "pam",
    name: "Privileged Access Management",
    shortName: "PAM",
    cpuBaseline: 58,
    memoryBaseline: 57,
    availabilityBaseline: 99.9,
  },
  {
    id: "mfa",
    name: "Multi-Factor Authentication",
    shortName: "MFA",
    cpuBaseline: 46,
    memoryBaseline: 52,
    availabilityBaseline: 99.98,
  },
  {
    id: "ad-entra",
    name: "Active Directory / Entra",
    shortName: "ADENTRA",
    cpuBaseline: 52,
    memoryBaseline: 62,
    availabilityBaseline: 99.9,
  },
  {
    id: "sase",
    name: "Secure Access Service Edge",
    shortName: "SASE",
    cpuBaseline: 54,
    memoryBaseline: 60,
    availabilityBaseline: 99.95,
  },
  {
    id: "siem",
    name: "Security Information & Event Management",
    shortName: "SIEM",
    cpuBaseline: 63,
    memoryBaseline: 64,
    availabilityBaseline: 99.85,
  },
  {
    id: "tip",
    name: "Threat Intelligence Platform",
    shortName: "TIP",
    cpuBaseline: 45,
    memoryBaseline: 53,
    availabilityBaseline: 99.9,
  },
  {
    id: "soar",
    name: "Security Orchestration, Automation & Response",
    shortName: "SOAR",
    cpuBaseline: 61,
    memoryBaseline: 58,
    availabilityBaseline: 99.9,
  },
  {
    id: "ansible",
    name: "Ansible Automation",
    shortName: "ANSIBLE",
    cpuBaseline: 49,
    memoryBaseline: 56,
    availabilityBaseline: 99.9,
  },
].map((platform) => ({
  ...platform,
  status: "UP",
  instances: Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `${platform.shortName}-${number}`,
      platform: platform.id,
      status: "UP",
      hostname: `${platform.id}-prod-${number}`,
      region: index % 3 === 2 ? "Surabaya" : "Jakarta",
      environment: index === 9 ? "Staging" : "Production",
    };
  }),
}));

module.exports = { platforms };
