export const CapabilityStatus = Object.freeze({
  DECLARED: "DECLARED",
  AVAILABLE: "AVAILABLE",
  OPTIONAL: "OPTIONAL",
  UNSUPPORTED: "UNSUPPORTED",
  MISCONFIGURED: "MISCONFIGURED",
});

export function capability(name, { command = null, required = false, status = null, evidence = {} } = {}) {
  return Object.freeze({
    name,
    status: status ?? (command ? CapabilityStatus.AVAILABLE : required ? CapabilityStatus.MISCONFIGURED : CapabilityStatus.UNSUPPORTED),
    required,
    command,
    evidence: Object.freeze(evidence),
  });
}

export function capabilityMap(entries) {
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, capability(name, value)]));
}
