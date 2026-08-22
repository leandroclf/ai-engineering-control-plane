import { redactValue } from "../security/redact.mjs";

function requireProject(task) {
  const project = task?.metadata?.projectDirectory;
  if (!project) throw new TypeError("task metadata.projectDirectory is required");
  return project;
}

function agentSchema(outcomes) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["outcome", "summary", "artifacts"],
    properties: {
      outcome: { type: "string", enum: outcomes },
      summary: { type: "string", minLength: 1, maxLength: 4000 },
      artifacts: { type: "array", maxItems: 100, items: { type: "string", maxLength: 500 } },
      openQuestions: { type: "array", maxItems: 50, items: { type: "string", maxLength: 1000 } },
    },
  };
}

function agentPrompt({ task, state, context }) {
  const artifacts = context?.artifacts ?? [];
  const approvedContext = artifacts.map((artifact) => [
    `Artifact: ${artifact.id}`,
    `Provenance: ${JSON.stringify(artifact.provenance ?? {})}`,
    artifact.content,
  ].join("\n")).join("\n\n");
  return [
    `Execute the governed workflow stage: ${state}.`,
    `Task: ${task?.metadata?.query ?? "No task description supplied."}`,
    "Use only the task, files available inside the project directory, and the approved context below.",
    "Do not commit, push, access secrets, or leave the project directory.",
    approvedContext ? `Approved context (${context.contextId}):\n${approvedContext}` : "Approved context: none.",
    "Return only the structured result requested by the schema.",
  ].join("\n\n");
}

function normalizeAgentEvidence(result) {
  return redactValue({
    summary: result.summary,
    artifacts: result.artifacts ?? [],
    ...(result.openQuestions?.length ? { openQuestions: result.openQuestions } : {}),
  });
}

async function runAgent(controller, request) {
  if (controller.runDetailed) return controller.runDetailed(request);
  return { structured: await controller.run(request), usage: null };
}

function gateOutcome(report) {
  if (report.gates?.some((gate) => gate.status === "error")) return "error";
  return report.status === "pass" ? "pass" : "fail";
}

function stageFrom(stage) {
  return stage.state_from ?? stage.from;
}

function repairEvidence(stages) {
  const prior = [...stages].reverse().find((stage) => stage.evidence?.handler?.gates);
  return prior?.evidence?.handler?.gates ?? [];
}

export function createWorkflowHandlers({ definition, store = null, controller, projectAdapter, gateRunner }) {
  if (!definition?.states) throw new TypeError("workflow definition is required");
  const handlers = {};
  for (const [state, stateDefinition] of Object.entries(definition.states)) {
    if (definition.terminal.includes(state)) continue;
    if (stateDefinition.agent) {
      handlers[state] = async ({ task, context }) => {
        const execution = await runAgent(controller, {
          directory: requireProject(task),
          agent: stateDefinition.agent,
          prompt: agentPrompt({ task, state, context }),
          schema: agentSchema(Object.keys(stateDefinition.next)),
        });
        return {
          outcome: execution.structured.outcome,
          evidence: {
            ...normalizeAgentEvidence(execution.structured),
            ...(execution.usage ? { usage: execution.usage } : {}),
          },
        };
      };
      continue;
    }
    if (stateDefinition.gates) {
      handlers[state] = async ({ task }) => {
        const project = requireProject(task);
        const profile = await projectAdapter.detect(project);
        const report = await gateRunner.run({ project, profile, gateNames: stateDefinition.gates });
        return { outcome: gateOutcome(report), evidence: redactValue({ projectKind: report.projectKind, gates: report.gates }) };
      };
      continue;
    }
    if (Number.isInteger(stateDefinition.maxIterations)) {
      handlers[state] = async ({ run, task }) => {
        if (!store?.listStages) throw new TypeError("repair states require a run store");
        const stages = await store.listStages(run.id);
        const iterations = stages.filter((stage) => stageFrom(stage) === state).length;
        if (iterations >= stateDefinition.maxIterations) {
          return {
            outcome: "exhausted",
            evidence: { reason: "ITERATION_BUDGET_EXHAUSTED", iterations },
          };
        }
        const gates = repairEvidence(stages);
        const execution = await runAgent(controller, {
          directory: requireProject(task),
          agent: "implementer",
          prompt: [
            "Perform a targeted repair for the failed governed gates below.",
            `Task: ${task?.metadata?.query ?? "Repair the blocking findings."}`,
            `Gate evidence: ${JSON.stringify(gates)}`,
            "Change only what is necessary. Do not commit, push, access secrets, or leave the project directory.",
            "Return progress only when project files changed; otherwise return exhausted.",
          ].join("\n\n"),
          schema: agentSchema(Object.keys(stateDefinition.next)),
        });
        return {
          outcome: execution.structured.outcome,
          evidence: {
            ...normalizeAgentEvidence(execution.structured),
            ...(execution.usage ? { usage: execution.usage } : {}),
            iterations: iterations + 1,
          },
        };
      };
      continue;
    }
    handlers[state] = async () => ({ outcome: "exhausted", evidence: { reason: "REPAIR_HANDLER_NOT_CONFIGURED" } });
  }
  return handlers;
}
