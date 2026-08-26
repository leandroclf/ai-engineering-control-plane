import test from "node:test";
import assert from "node:assert/strict";

import { createImplementationContract, normalizeReviewFinding, planTask, shouldInvokeArchitect } from "../../harness/src/agents/role-contract.mjs";
import { compileProgressiveContext, deduplicateWithProvenance, resolveCapabilities } from "../../context/compiler/context-intelligence.mjs";
import { SkillManifestRegistry } from "../../harness/src/skills/manifest-resolver.mjs";

test("Planner emits a bounded TaskPlan and Architect is conditional", () => {
  const local = planTask({ objective: "corrigir validação de formulário", acceptanceCriteria: ["teste passa"] });
  const structural = planTask({ objective: "alterar contrato OAuth e schema de autenticação", risk: { level: "high" } });
  assert.equal(shouldInvokeArchitect(local), false);
  assert.equal(shouldInvokeArchitect(structural), true);
  assert.equal("workflow" in local, false);
  assert.equal(local.securityReviewRequired, false);
});

test("ImplementationContract is bounded and traceable to acceptance criteria", () => {
  const plan = planTask({ objective: "adicionar endpoint", scope: { include: ["src/api"], exclude: ["deploy"] }, acceptanceCriteria: ["retorna 200"] });
  const contract = createImplementationContract({ taskPlan: plan, relevantContext: ["ctx_1"], requiredTests: ["npm test"], evidenceRequired: ["diff"] });
  assert.match(contract.contractId, /^ic_[a-f0-9]{64}$/);
  assert.deepEqual(contract.acceptanceCriteria, ["retorna 200"]);
  assert.deepEqual(contract.nonGoals, ["deploy"]);
});

test("progressive disclosure filters, deduplicates with provenance and defers overflow", () => {
  const candidates = [
    { id: "policy", kind: "policy", category: "system_and_role", priority: 0, capabilities: ["java"], content: "policy", summary: "policy", tokens: 3, contentHash: "same" },
    { id: "adr", kind: "adr", category: "repository_context", priority: 2, capabilities: ["java"], content: "non blocking", summary: "reactive", tokens: 4, canonicalKey: "reactive.no-blocking" },
    { id: "skill", kind: "skill", category: "knowledge_skills", priority: 4, capabilities: ["java"], content: "long skill body", summary: "skill summary", tokens: 20, disclosure: "on-demand" },
    { id: "irrelevant", kind: "skill", capabilities: ["python"], content: "python", tokens: 1 },
  ];
  const result = compileProgressiveContext({ taskPlan: { requiredCapabilities: ["java"] }, candidates, budget: { maxInputTokens: 10, reserve: 0.1 }, expand: [] });
  assert.deepEqual(result.artifacts.map((item) => item.id), ["policy", "adr"]);
  assert.ok(result.expandable.some((item) => item.id === "skill"));
  assert.equal(result.artifacts.some((item) => item.id === "irrelevant"), false);
  assert.ok(result.evidence.every((item) => item.source));
  const dedup = deduplicateWithProvenance([{ id: "a", kind: "repo", content: "same", source: "AGENTS.md" }, { id: "b", kind: "skill", content: "same", source: "skill:x" }]);
  assert.equal(dedup.length, 1);
  assert.equal(dedup[0].provenance.length, 2);
});

test("capability resolver and reviewer finding keep authority explicit", () => {
  const registry = new SkillManifestRegistry({ schemaVersion: 1, manifests: [{ id: "spring", version: "1", capabilities: ["framework.spring"], appliesWhen: ["spring webflux"], knowledge: { source: "skills/spring", disclosure: "on-demand" } }] });
  assert.deepEqual(resolveCapabilities({ objective: "spring webflux endpoint", manifests: registry.list() }), ["framework.spring"]);
  const finding = normalizeReviewFinding({ requirementId: "AC-1", diffRef: "src/a.js", testRef: "tests/a.test.mjs", evidenceRef: "gate:unit-tests", message: "missing test" });
  assert.equal(finding.requirementId, "AC-1");
});
