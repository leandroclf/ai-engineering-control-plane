import { readFile } from "node:fs/promises";

import { createOpencode } from "@opencode-ai/sdk";
import pg from "pg";

import { ContextApiClient } from "../../../context/client/context-api-client.mjs";
import { BudgetAuthority } from "../budget/budget-authority.mjs";
import { PostgresBudgetStore } from "../budget/postgres-budget-store.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
import { GovernedContextProvider } from "../agents/governed-context-provider.mjs";
import { OpenCodeController } from "../agents/opencode-controller.mjs";
import { ProjectAdapter } from "../gates/project-adapter.mjs";
import { ProjectGateRunner } from "../gates/project-gate-runner.mjs";
import { GateRegistry, ProjectGateProvider, ScannerGateProvider } from "../gates/gate-registry.mjs";
import { OtlpHttpTelemetry } from "../telemetry/otlp-http-telemetry.mjs";
import { WorkspaceAttestor } from "../security/workspace-attestation.mjs";
import { PostgresRunStore } from "../workflow/postgres-run-store.mjs";
import { GovernedRuntime } from "./governed-runtime.mjs";
import { createWorkflowHandlers } from "./workflow-handlers.mjs";

const { Pool } = pg;

function required(environment, name) {
  if (!environment[name]) throw new TypeError(`${name} is required`);
  return environment[name];
}

export async function createProductionRuntime({ environment = process.env } = {}) {
  const definition = JSON.parse(await readFile(
    environment.HARNESS_WORKFLOW_PATH ?? "harness/workflows/feature.yaml",
    "utf8",
  ));
  const gateConfiguration = JSON.parse(await readFile(environment.HARNESS_GATES_PATH ?? "harness/config/gates.yaml", "utf8"));
  const database = new Pool({
    connectionString: required(environment, "DATABASE_URL"),
    max: Number(environment.HARNESS_DATABASE_POOL_SIZE ?? 5),
    application_name: "aicp-harness",
  });
  let opencode;
  try {
    await database.query("SELECT 1");
    opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: Number(environment.OPENCODE_SERVER_PORT ?? 4096),
      timeout: Number(environment.OPENCODE_START_TIMEOUT_MS ?? 30_000),
    });
    const store = new PostgresRunStore(database);
    const budgetAuthority = new BudgetAuthority({ store: new PostgresBudgetStore(database), reservation: {
      maxOutputTokens: Number(environment.HARNESS_RESERVATION_OUTPUT_TOKENS ?? 4096),
      maxCostUsd: Number(environment.HARNESS_RESERVATION_COST_USD ?? 1),
    } });
    const projectAdapter = new ProjectAdapter();
    const workspaceAttestor = new WorkspaceAttestor({ projectRoot: environment.PROJECTS_ROOT ?? "/workspace", environment });
    const gateRegistry = new GateRegistry({ definitions: gateConfiguration.gates })
      .register("project", new ProjectGateProvider())
      .register("semgrep", new ScannerGateProvider("semgrep"))
      .register("gitleaks", new ScannerGateProvider("gitleaks"))
      .register("trivy", new ScannerGateProvider("trivy"));
    const handlers = createWorkflowHandlers({
      definition,
      store,
      controller: new OpenCodeController(opencode.client),
      projectAdapter,
      gateRunner: new ProjectGateRunner({ runner: new ProcessRunner() }),
      gateRegistry,
      budgetAuthority,
    });
    const runtime = new GovernedRuntime({
      definition,
      store,
      handlers,
      contextProvider: new GovernedContextProvider({
        contextClient: new ContextApiClient({
          baseUrl: required(environment, "MEMORY_SERVICE_URL"),
          token: required(environment, "MEMORY_SERVICE_TOKEN"),
        }),
      }),
      telemetry: new OtlpHttpTelemetry({ endpoint: environment.OTEL_EXPORTER_OTLP_ENDPOINT }),
      budgetAuthority,
      preflight: async (task) => {
        const project = task.metadata.projectDirectory;
        await workspaceAttestor.attest(project);
        const profile = await projectAdapter.detect(project);
        const names = [...new Set(Object.values(definition.states).flatMap((state) => state.gates ?? []))];
        await gateRegistry.preflight({ names, project, profile });
      },
    });
    return {
      runtime,
      async close() {
        opencode.server.close();
        await database.end();
      },
    };
  } catch (error) {
    opencode?.server.close();
    await database.end();
    throw error;
  }
}
