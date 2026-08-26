import { createHash } from "node:crypto";

export const AGENT_ROLES = Object.freeze(["planner", "architect", "implementer", "reviewer", "security-reviewer"]);
export const ARCHITECTURE_IMPACTS = Object.freeze(["local", "structural"]);
export const RISK_LEVELS = Object.freeze(["low", "medium", "high"]);

const STRUCTURAL_TERMS = /\b(arquitet|architecture|schema|database|migration|public api|contrato|contract|boundary|security|auth|oauth|infra|deploy|workflow|state|persist|breaking|monorepo)\b/i;
const AMBIGUOUS_TERMS = /\b(melhorar|melhore|otimizar|refatorar|fixar|ajustar|improve|optimize|refactor|fix)\b/i;

function list(value) { return [...new Set((Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))]; }
function level(value) { return RISK_LEVELS.includes(value) ? value : "medium"; }
function impact(value) { return ARCHITECTURE_IMPACTS.includes(value) ? value : "local"; }
function hash(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export function planTask({ objective, intent = "feature", scope = {}, risk = {}, requiredCapabilities = [], securityReviewRequired = false, acceptanceCriteria = [] } = {}) {
  if (typeof objective !== "string" || !objective.trim()) throw new TypeError("task objective is required");
  const riskLevel = level(risk.level);
  const reasons = list(risk.reasons);
  const architectureImpact = impact(risk.architectureImpact ?? (STRUCTURAL_TERMS.test(objective) || riskLevel === "high" ? "structural" : "local"));
  const ambiguous = Boolean(risk.ambiguous ?? (AMBIGUOUS_TERMS.test(objective) && !acceptanceCriteria.length));
  return Object.freeze({
    schemaVersion: 1,
    objective: objective.trim(),
    intent: typeof intent === "string" && intent.trim() ? intent.trim() : "feature",
    scope: Object.freeze({ include: list(scope.include), exclude: list(scope.exclude) }),
    risk: Object.freeze({ level: riskLevel, reasons }),
    architectureImpact,
    requiredCapabilities: list(requiredCapabilities),
    securityReviewRequired: Boolean(securityReviewRequired || riskLevel === "high" || /\b(security|auth|credential|secret|oauth)\b/i.test(objective)),
    acceptanceCriteria: list(acceptanceCriteria),
    ambiguous,
    planner: "deterministic-harness-planner-v1",
  });
}

export function assertTaskPlan(plan) {
  if (!plan || plan.schemaVersion !== 1 || typeof plan.objective !== "string") throw new TypeError("TaskPlan v1 is required");
  if (!ARCHITECTURE_IMPACTS.includes(plan.architectureImpact) || !RISK_LEVELS.includes(plan.risk?.level)) throw new TypeError("TaskPlan has invalid impact or risk");
  if ("workflow" in plan || "stateTransition" in plan || "budgetDecision" in plan || "toolCalls" in plan) throw new Error("PLANNER_AUTHORITY_VIOLATION");
  return plan;
}

export function shouldInvokeArchitect(plan) {
  assertTaskPlan(plan);
  return plan.architectureImpact === "structural" || plan.risk.level === "high";
}

export function createImplementationContract({ taskPlan, architectureDecisions = [], relevantContext = [], requiredTests = [], constraints = [], evidenceRequired = [] } = {}) {
  assertTaskPlan(taskPlan);
  const contract = {
    schemaVersion: 1,
    contractId: null,
    objective: taskPlan.objective,
    scope: taskPlan.scope,
    nonGoals: taskPlan.scope.exclude,
    constraints: list(constraints),
    affectedAreas: taskPlan.scope.include,
    architectureDecisions: list(architectureDecisions),
    relevantContext: list(relevantContext),
    requiredTests: list(requiredTests),
    acceptanceCriteria: taskPlan.acceptanceCriteria,
    evidenceRequired: list(evidenceRequired),
    requiredCapabilities: taskPlan.requiredCapabilities,
    securityReviewRequired: taskPlan.securityReviewRequired,
    architectureReview: shouldInvokeArchitect(taskPlan) ? "required" : "not-required",
  };
  contract.contractId = `ic_${hash(contract)}`;
  return Object.freeze(contract);
}

export function assertImplementationContract(contract) {
  if (!contract || contract.schemaVersion !== 1 || !/^ic_[a-f0-9]{64}$/.test(contract.contractId)) throw new TypeError("ImplementationContract v1 is required");
  if ("workflow" in contract || "budget" in contract || "toolCalls" in contract) throw new Error("IMPLEMENTER_AUTHORITY_VIOLATION");
  return contract;
}

export function normalizeReviewFinding({ requirementId, diffRef, testRef, evidenceRef, severity = "medium", message } = {}) {
  if (![requirementId, diffRef, testRef, evidenceRef, message].every((value) => typeof value === "string" && value.trim())) throw new TypeError("review finding must reference requirement, diff, test and evidence");
  return Object.freeze({ schemaVersion: 1, requirementId, diffRef, testRef, evidenceRef, severity, message: message.trim() });
}

export function assertReviewFindings(findings = []) {
  if (!Array.isArray(findings)) throw new TypeError("review findings must be an array");
  return findings.map((finding) => normalizeReviewFinding(finding));
}
