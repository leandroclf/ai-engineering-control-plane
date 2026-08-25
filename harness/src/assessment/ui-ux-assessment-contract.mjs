import { assertStructuredOutput } from "../providers/provider-contract.mjs";

const evidenceSchema = {
  type: "array",
  minItems: 1,
  maxItems: 8,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["path", "locator", "detail"],
    properties: {
      path: { type: "string", minLength: 1, maxLength: 300 },
      locator: { type: "string", minLength: 1, maxLength: 300 },
      detail: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
};

export const UI_UX_ASSESSMENT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["outcome", "summary", "findings", "artifacts", "openQuestions"],
  properties: {
    outcome: { type: "string", enum: ["completed", "blocked", "failed"] },
    summary: { type: "string", minLength: 1, maxLength: 6000 },
    findings: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "area", "severity", "title", "evidence", "recommendation", "impact", "effort", "confidence"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          area: { type: "string", enum: ["visual", "ux", "accessibility", "seo", "performance", "conversion"] },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          title: { type: "string", minLength: 1, maxLength: 300 },
          evidence: evidenceSchema,
          recommendation: { type: "string", minLength: 1, maxLength: 1500 },
          impact: { type: "string", minLength: 1, maxLength: 800 },
          effort: { type: "string", enum: ["small", "medium", "large"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    artifacts: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "kind", "description"],
        properties: {
          path: { type: "string", minLength: 1, maxLength: 300 },
          kind: { type: "string", enum: ["source", "route", "screenshot", "baseline", "asset"] },
          description: { type: "string", minLength: 1, maxLength: 800 },
        },
      },
    },
    openQuestions: { type: "array", maxItems: 30, items: { type: "string", maxLength: 1000 } },
  },
});

export function normalizeUiUxAssessment(value) {
  assertStructuredOutput(value, UI_UX_ASSESSMENT_SCHEMA);
  return structuredClone(value);
}

export function uiUxAssessmentPrompt({ project, query, state = "assessment" } = {}) {
  return [
    `Realize a etapa ${state} de uma avaliação UI/UX read-only do projeto ${project}.`,
    `Objetivo da tarefa: ${query ?? "avaliar integralmente a experiência do site"}.`,
    "Não altere arquivos, não crie arquivos, não execute comandos destrutivos, não faça commit e não acesse credenciais.",
    "Analise o projeto completo, incluindo rotas HTML, CSS, JavaScript, assets, dashboards e documentação relevante.",
    "Cubra hierarquia visual, UX, responsividade, acessibilidade, SEO, performance percebida e conversão.",
    "Cada finding deve conter evidência concreta por caminho, rota, seletor, linha ou identificação do asset; o campo locator é obrigatório em toda evidência. Não invente fatos.",
    "Retorne somente o structured output solicitado, com findings priorizados por severidade, impacto, esforço e confiança.",
  ].join("\n\n");
}
