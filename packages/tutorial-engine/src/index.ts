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

export const academyModules = [
  ["foundations", "Foundations", "O modelo mental do AICP e suas autoridades."],
  ["first-run", "First Governed Run", "Do pedido ao human review, passo a passo."],
  ["authority", "Authority Model", "Por que LLMs não controlam workflow, budget ou gates."],
  ["execution", "Execution Plane", "Workers efêmeros, worktrees e credenciais por run."],
  ["budgets", "Budgets", "Reserva transacional e reconciliação física."],
  ["context", "Context Compiler", "Retrieval determinístico dentro do envelope de tokens."],
  ["memory", "Memory", "Scopes, validade, autoridade e reconciliação."],
  ["graph", "Knowledge Graph", "Relações derivadas e impacto sem queries arbitrárias."],
  ["security", "Security", "Gates fail-closed e defesa em profundidade."],
  ["release", "Release Certification", "Como ler os controles e seus blockers reais."],
] as const;
