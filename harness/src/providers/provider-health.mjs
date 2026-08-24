export function healthStatus({ binary = {}, auth = {}, policy = {}, quota = {}, liveInference = {} } = {}) {
  const liveness = binary.available === false ? "error" : "ok";
  const readiness = policy.allowed === false ? "denied" : auth.status === "unauthenticated" ? "auth_required" : quota.status === "exhausted" ? "quota_exhausted" : "ready";
  return { liveness, binary, auth, policy, quota, liveInference, readiness };
}

export function isProviderReady(health) {
  return health?.liveness === "ok" && health?.readiness === "ready" && health?.policy?.allowed !== false;
}
