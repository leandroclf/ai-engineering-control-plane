import { createHash } from "node:crypto";

export const CONTEXT_KINDS = Object.freeze(["policy", "task", "repo", "adr", "skill", "retrieval"]);
const KIND_PRIORITY = Object.freeze({ policy: 0, task: 1, repo: 2, adr: 2, project: 3, skill: 4, retrieval: 5 });

function hash(value) { return createHash("sha256").update(String(value ?? "")).digest("hex"); }
function tokens(candidate) { return Number.isInteger(candidate.tokens) && candidate.tokens >= 0 ? candidate.tokens : Math.ceil(String(candidate.content ?? candidate.summary ?? "").length / 4); }
function normalize(value) { return String(value ?? "").toLowerCase().replaceAll(/\s+/g, " ").trim(); }
function sourceOf(candidate) { return candidate.source ?? candidate.provenance?.source ?? candidate.provenance?.path ?? candidate.id; }
function relevant(candidate, capabilities) { return !capabilities?.length || !candidate.capabilities?.length || candidate.capabilities.some((capability) => capabilities.includes(capability)); }

export function resolveCapabilities({ objective = "", requiredCapabilities = [], manifests = [] } = {}) {
  const text = normalize(objective);
  const inferred = manifests.flatMap((manifest) => (manifest.appliesWhen ?? []).some((term) => text.includes(normalize(term))) ? manifest.capabilities ?? [] : []);
  return [...new Set([...requiredCapabilities, ...inferred])].sort();
}

export function toContextEvidence(candidate, disclosure = "summary") {
  const kind = CONTEXT_KINDS.includes(candidate.kind) ? candidate.kind : "retrieval";
  const content = disclosure === "metadata" ? "" : disclosure === "summary" ? (candidate.summary ?? candidate.content ?? "") : (candidate.content ?? candidate.summary ?? "");
  return {
    id: candidate.id,
    kind,
    source: sourceOf(candidate),
    ...(candidate.revision ? { revision: candidate.revision } : {}),
    contentHash: candidate.contentHash ?? hash(candidate.content ?? candidate.summary ?? ""),
    ...(candidate.capability ? { capability: candidate.capability } : {}),
    priority: candidate.priority ?? KIND_PRIORITY[kind],
    estimatedTokens: tokens({ ...candidate, content }),
  };
}

export function deduplicateWithProvenance(candidates = []) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!candidate?.id) continue;
    const statement = normalize(candidate.canonicalKey ?? candidate.statement ?? candidate.content ?? candidate.summary);
    const key = candidate.contentHash ?? hash(statement);
    const current = groups.get(key);
    const evidence = toContextEvidence(candidate, "summary");
    if (!current) {
      groups.set(key, { ...candidate, tokens: tokens(candidate), provenance: [...(candidate.provenance ?? []), evidence], sources: [sourceOf(candidate)] });
      continue;
    }
    current.provenance = [...current.provenance, ...(candidate.provenance ?? []), evidence];
    current.sources = [...new Set([...current.sources, sourceOf(candidate)])].sort();
    if ((candidate.priority ?? KIND_PRIORITY[candidate.kind] ?? 9) < (current.priority ?? 9)) Object.assign(current, { ...candidate, provenance: current.provenance, sources: current.sources });
  }
  return [...groups.values()].map((candidate) => ({ ...candidate, provenance: candidate.provenance.map((item) => typeof item === "string" ? { id: item, kind: "retrieval", source: item, contentHash: hash(item), priority: 5, estimatedTokens: 0 } : item) }));
}

function categoryBudget(budget, category) {
  const allocation = budget.allocations?.[category];
  return allocation === undefined ? Number.POSITIVE_INFINITY : Math.floor(budget.maxInputTokens * allocation);
}

export function compileProgressiveContext({ taskPlan = {}, candidates = [], budget = {}, expand = [] } = {}) {
  const maxInputTokens = Number.isInteger(budget.maxInputTokens) && budget.maxInputTokens >= 0 ? budget.maxInputTokens : 0;
  const reserve = Math.max(0, Math.floor(maxInputTokens * Number(budget.reserve ?? budget.allocations?.reserve ?? 0)));
  const deduplicated = deduplicateWithProvenance(candidates).filter((candidate) => relevant(candidate, taskPlan.requiredCapabilities ?? taskPlan.capabilities ?? []));
  const selected = [];
  const deferred = [];
  const categoryUsed = new Map();
  let used = 0;
  const ordered = deduplicated.sort((left, right) => (left.priority ?? 9) - (right.priority ?? 9) || left.id.localeCompare(right.id));
  for (const candidate of ordered) {
    const disclosure = expand.includes(candidate.id) ? "full" : candidate.disclosure === "on-demand" ? "summary" : candidate.disclosure ?? "summary";
    const evidence = toContextEvidence(candidate, disclosure);
    const category = candidate.category ?? candidate.kind ?? "retrieved_context";
    const cap = categoryBudget({ ...budget, maxInputTokens }, category);
    const allowed = maxInputTokens - reserve;
    if (used + evidence.estimatedTokens <= allowed && (categoryUsed.get(category) ?? 0) + evidence.estimatedTokens <= cap) {
      selected.push({ ...candidate, content: disclosure === "full" ? candidate.content ?? candidate.summary ?? "" : candidate.summary ?? candidate.content ?? "", disclosure, provenance: candidate.provenance ?? [evidence], evidence });
      used += evidence.estimatedTokens;
      categoryUsed.set(category, (categoryUsed.get(category) ?? 0) + evidence.estimatedTokens);
    } else deferred.push({ id: candidate.id, source: sourceOf(candidate), disclosure: "on-demand", estimatedTokens: evidence.estimatedTokens });
  }
  const provenance = selected.flatMap((candidate) => candidate.provenance).map((item) => typeof item === "string" ? toContextEvidence({ id: item, source: item }) : item);
  return {
    schemaVersion: 1,
    instructions: selected.map((candidate) => `[${candidate.id}] ${candidate.content}`).join("\n\n"),
    artifacts: selected,
    evidence: provenance,
    budget: { used, maxInputTokens, reserve, remaining: Math.max(0, maxInputTokens - used), categoryUsed: Object.fromEntries(categoryUsed) },
    expandable: deferred,
    metrics: { selectedCount: selected.length, deferredCount: deferred.length, contextExpansionCount: expand.length, usefulContextRatio: maxInputTokens ? used / maxInputTokens : 0 },
  };
}
