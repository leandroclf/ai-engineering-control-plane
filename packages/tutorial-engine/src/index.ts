export type TutorialStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
};

export type TutorialManifest = { id: string; version: number; steps: TutorialStep[] };

export const firstGovernedRun: TutorialManifest = {
  id: "first-governed-run",
  version: 1,
  steps: [
    { id: "readiness", route: "/", target: "release-readiness", title: "Release readiness", body: "Comece pela evidência: o AICP mostra PASS, BLOCKED e FAILED sem esconder bloqueios." },
    { id: "workflow", route: "/runs/demo-run", target: "workflow-timeline", title: "Governed workflow", body: "Cada etapa é decidida pelo Harness; o agente produz resultado, não transições." },
    { id: "budget", route: "/runs/demo-run", target: "budget", title: "Bounded execution", body: "Budget lógico, tokens, custo estimado e tentativas físicas ficam visíveis no mesmo contexto." },
    { id: "evidence", route: "/runs/demo-run", target: "evidence", title: "Evidence", body: "Um PASS só é útil quando você consegue abrir a evidência que o sustenta." },
  ],
};

export type AcademyModule = { id: string; title: string; description: string; estimatedMinutes: number; objectives: string[]; lessons: { concept: string; route?: string; target?: string }[]; checkpoint: { question: string; options: string[]; answer: string } };

const module = (id: string, title: string, description: string, question: string, answer: string, route = "/"): AcademyModule => ({ id, title, description, estimatedMinutes: 8, objectives: ["Explain the authority boundary", "Locate the supporting evidence"], lessons: [{ concept: description, route }], checkpoint: { question, options: ["Harness", "AICP Console", "OpenCode", "LiteLLM"], answer } });

export const academyModules: AcademyModule[] = [
  module("foundations", "Foundations", "The AICP separates untrusted execution from deterministic governance.", "Which component governs engineering work?", "Harness"),
  module("authority", "Authority Model", "Harness owns workflow, budgets, gates, authorization and termination.", "Who can advance a governed workflow?", "Harness", "/docs/authority"),
  module("first-run", "First Governed Run", "Inspect a deterministic run from release readiness to evidence.", "Where can you inspect a governed run?", "AICP Console", "/runs/demo-run"),
  module("evidence", "Evidence", "A status is useful only when the underlying evidence can be opened.", "Who records canonical gate evidence?", "Harness", "/runs/demo-run"),
  module("budgets", "Budgets", "Logical reservations and physical usage are reconciled by policy.", "Who can block the next call when budget is exhausted?", "Harness", "/governance/budgets"),
  module("execution", "Execution Plane", "Workers are isolated and disposable for each governed run.", "Which component creates isolated workers?", "Harness", "/docs/execution-plane"),
  module("context", "Context", "Context compilation is bounded, deterministic and provenance-aware.", "Who owns context retrieval policy?", "Harness", "/knowledge/context"),
  module("memory", "Memory", "Memory is scoped by relevance, authority and validity.", "Which state store is canonical?", "Harness", "/knowledge/memory"),
  module("graph", "Graph", "Graph relationships are derived and rebuildable.", "Which component is not canonical state?", "AICP Console", "/knowledge/graph"),
  module("security", "Security", "Security gates fail closed and browser boundaries protect credentials.", "Who owns provider credentials?", "LiteLLM", "/security"),
  module("recovery", "Recovery", "Recovery rebuilds derived projections from canonical state and evidence.", "Which component remains canonical during recovery?", "Harness", "/docs/data"),
  module("release", "Release Certification", "Release readiness shows real blockers rather than cosmetic PASS states.", "Who makes the release decision?", "Harness", "/release"),
  module("extension-lab", "Extension Lab", "Extensions add bounded capability without bypassing governance.", "Who authorizes an extension to execute?", "Harness", "/docs/governed-execution"),
  module("final-challenge", "Final Challenge", "Explain state, reason, authority and evidence for a blocked run.", "Which component explains a BLOCKED state with evidence?", "Harness", "/runs/demo-run"),
];
