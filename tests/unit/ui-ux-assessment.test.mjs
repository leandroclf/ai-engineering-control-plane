import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { assertStructuredOutput } from "../../harness/src/providers/provider-contract.mjs";
import {
  UI_UX_ASSESSMENT_SCHEMA,
  normalizeUiUxAssessment,
  uiUxAssessmentPrompt,
} from "../../harness/src/assessment/ui-ux-assessment-contract.mjs";

test("UI/UX assessment schema requires bounded evidence-backed findings", () => {
  const result = {
    outcome: "completed",
    summary: "A análise encontrou melhorias de navegação.",
    findings: [{
      id: "ux-001",
      area: "ux",
      severity: "high",
      title: "Navegação principal pouco explícita",
      evidence: [{ path: "index.html", locator: "header nav", detail: "A navegação não diferencia a página atual." }],
      recommendation: "Adicionar estado ativo e agrupamento semântico.",
      impact: "Melhora a orientação e a conversão.",
      effort: "small",
      confidence: "high",
    }],
    artifacts: [{ path: "index.html", kind: "source", description: "Página inicial analisada." }],
    openQuestions: [],
  };

  assert.doesNotThrow(() => assertStructuredOutput(result, UI_UX_ASSESSMENT_SCHEMA));
  assert.deepEqual(normalizeUiUxAssessment(result), result);
});

test("UI/UX assessment rejects findings without concrete evidence", () => {
  assert.throws(() => assertStructuredOutput({
    outcome: "completed",
    summary: "Sem evidência.",
    findings: [{
      id: "ux-002",
      area: "visual",
      severity: "medium",
      title: "Ajustar cores",
      evidence: [],
      recommendation: "Ajustar.",
      impact: "Melhora.",
      effort: "small",
      confidence: "low",
    }],
    artifacts: [],
    openQuestions: [],
  }, UI_UX_ASSESSMENT_SCHEMA), /evidence/);
});

test("UI/UX assessment prompt enforces read-only analysis and route coverage", () => {
  const prompt = uiUxAssessmentPrompt({ project: "site-lf-solucoes", query: "Avaliar UI/UX" });
  assert.match(prompt, /Não altere arquivos/);
  assert.match(prompt, /evidência concreta/);
  assert.match(prompt, /responsividade/);
});

test("UI/UX assessment workflow contains no mutating agent stage", async () => {
  const definition = JSON.parse(await readFile("harness/workflows/ui-ux-assessment.yaml", "utf8"));
  assert.equal(definition.name, "ui-ux-assessment");
  assert.deepEqual(definition.terminal, ["ready-for-human-review", "human-review", "failed"]);
  for (const [state, value] of Object.entries(definition.states)) {
    if (value.agent) assert.notEqual(value.agent, "implementer", state);
  }
  assert.deepEqual(definition.states.inventory.next, { completed: "assessment", blocked: "human-review", failed: "failed" });
});
