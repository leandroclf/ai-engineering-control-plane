export class PolicyAuthority {
  constructor({ version, rules = {} }) { if (!version) throw new TypeError("policy version is required"); this.version = version; this.rules = structuredClone(rules); Object.freeze(this.rules); }
  decision(capability, context = {}) {
    const rule = this.rules[capability];
    if (!rule) return { allowed: false, reason: "POLICY_UNDEFINED", policyVersion: this.version };
    const allowed = rule.enabled === true && (!rule.roles || rule.roles.some((role) => context.roles?.includes(role)));
    return { allowed, reason: allowed ? "POLICY_ALLOWED" : "POLICY_DENIED", policyVersion: this.version };
  }
}
