import { readFile } from "node:fs/promises";

import { createOpencode } from "@opencode-ai/sdk";
import pg from "pg";

import { ContextApiClient } from "../../../context/client/context-api-client.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
import { GovernedContextProvider } from "../agents/governed-context-provider.mjs";
import { OpenCodeController } from "../agents/opencode-controller.mjs";
import { ProjectAdapter } from "../gates/project-adapter.mjs";
import { ProjectGateRunner } from "../gates/project-gate-runner.mjs";
import { OtlpHttpTelemetry } from "../telemetry/otlp-http-telemetry.mjs";
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
    const handlers = createWorkflowHandlers({
      definition,
      store,
      controller: new OpenCodeController(opencode.client),
      projectAdapter: new ProjectAdapter(),
      gateRunner: new ProjectGateRunner({ runner: new ProcessRunner() }),
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
