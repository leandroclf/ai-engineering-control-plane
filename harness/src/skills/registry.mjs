import { fingerprint } from "../capabilities/provider.mjs";

export const SKILL_STATUSES = ["EXPERIMENTAL", "VALIDATED", "PROMOTED", "DEPRECATED", "REJECTED"];
const transitions = { EXPERIMENTAL: ["VALIDATED", "REJECTED"], VALIDATED: ["PROMOTED", "DEPRECATED"], PROMOTED: ["DEPRECATED"], DEPRECATED: [], REJECTED: [] };

export class SkillRegistry {
  #skills = new Map();
  register(skill) {
    if (!skill?.name || !skill?.version) throw new TypeError("skill name and version are required");
    const item = { ...skill, status: skill.status ?? "EXPERIMENTAL", capabilities: [...(skill.capabilities ?? [])], successRate: skill.successRate ?? null, fingerprint: fingerprint(skill) };
    if (!SKILL_STATUSES.includes(item.status)) throw new Error("SKILL_STATUS_INVALID");
    this.#skills.set(`${item.name}@${item.version}`, item); return item;
  }
  registerPersisted(skill) {
    return this.register({ name: skill.name, version: skill.version, domain: skill.domain, capabilities: skill.capabilities ?? [], metadata: skill.metadata ?? {}, status: skill.status ?? "EXPERIMENTAL", successRate: skill.success_rate ?? skill.successRate ?? null, createdBy: skill.created_by ?? skill.createdBy ?? "memory-service", fingerprint: skill.fingerprint });
  }
  get(name, version) { return this.#skills.get(`${name}@${version}`); }
  transition(name, version, status, { actor, evidence = [] } = {}) {
    const item = this.get(name, version);
    if (!item || !transitions[item.status]?.includes(status)) throw new Error("SKILL_TRANSITION_INVALID");
    if (["VALIDATED", "PROMOTED"].includes(status) && (!actor || actor === "agent") && !evidence.length) throw new Error("SKILL_VALIDATION_EVIDENCE_REQUIRED");
    item.status = status; item.lifecycle = [...(item.lifecycle ?? []), { status, actor: actor ?? "unknown", evidence, at: new Date().toISOString() }]; return item;
  }
  retrieve({ query = "", capabilities = [], domain, limit = 5 } = {}) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.#skills.values()].filter((s) => !["REJECTED", "DEPRECATED"].includes(s.status)).map((s) => {
      const text = `${s.name} ${s.domain ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
      const lexical = terms.filter((term) => text.includes(term)).length;
      const capabilityMatch = capabilities.filter((cap) => s.capabilities.includes(cap)).length;
      const domainMatch = domain && s.domain === domain ? 2 : 0;
      const historical = typeof s.successRate === "number" ? s.successRate : 0;
      return { skill: s, score: lexical + capabilityMatch * 2 + domainMatch + historical };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  list() { return [...this.#skills.values()]; }
}
