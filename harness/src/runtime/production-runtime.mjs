import { readFile } from "node:fs/promises";

import { createOpencode } from "@opencode-ai/sdk";
import pg from "pg";

import { ContextApiClient } from "../../../context/client/context-api-client.mjs";
import { BudgetAuthority } from "../budget/budget-authority.mjs";
import { InvocationEstimator, RoutingPricingCatalog } from "../budget/invocation-estimator.mjs";
import { PostgresBudgetStore } from "../budget/postgres-budget-store.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
import { GovernedContextProvider } from "../agents/governed-context-provider.mjs";
import { OpenCodeController } from "../agents/opencode-controller.mjs";
import { ProjectAdapter } from "../gates/project-adapter.mjs";
import { ProjectGateRunner } from "../gates/project-gate-runner.mjs";
import { GateRegistry, ProjectGateProvider, ScannerGateProvider } from "../gates/gate-registry.mjs";
import { OtlpHttpTelemetry } from "../telemetry/otlp-http-telemetry.mjs";
import { RoutingPolicy } from "../routing/routing-policy.mjs";
import { ScannerBundleAttestor } from "../scanners/scanner-bundle-attestor.mjs";
import { WorkspaceAttestor } from "../security/workspace-attestation.mjs";
import { HttpWorkerManager } from "../workers/http-worker-manager.mjs";
import { WorkerProfileRegistry } from "../workers/worker-profile-registry.mjs";
import { LocalExecutionPlane } from "../execution/local-execution-plane.mjs";
import { WorkerExecutionPlane } from "../execution/worker-execution-plane.mjs";
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
  const routingConfiguration = JSON.parse(await readFile(environment.HARNESS_MODEL_ROUTING_PATH ?? "harness/config/model-routing.json", "utf8"));
  const scannerBundle = JSON.parse(await readFile(environment.HARNESS_SCANNER_BUNDLE_PATH ?? "security/scanner-bundle.json", "utf8"));
  const workerProfiles = new WorkerProfileRegistry(JSON.parse(await readFile(environment.WORKER_PROFILES_PATH ?? "harness/config/worker-profiles.json", "utf8")));
  const ephemeral = environment.AICP_EXECUTION_MODE === "ephemeral";
  if (environment.AICP_RELEASE_MODE === "production" && !ephemeral) throw new Error("PRODUCTION_REQUIRES_EPHEMERAL_EXECUTION");
  const workerManager = ephemeral ? new HttpWorkerManager({ baseUrl: required(environment, "WORKER_MANAGER_URL"), token: required(environment, "WORKER_MANAGER_TOKEN"), clientProjectRoot: environment.WORKER_CLIENT_PROJECT_ROOT ?? environment.PROJECTS_ROOT ?? "/workspace" }) : null;
  const database = new Pool({
    connectionString: required(environment, "DATABASE_URL"),
    max: Number(environment.HARNESS_DATABASE_POOL_SIZE ?? 5),
    application_name: "aicp-harness",
  });
  let opencode = null;
  try {
    await database.query("SELECT 1");
    if (!ephemeral) opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: Number(environment.OPENCODE_SERVER_PORT ?? 4096),
      timeout: Number(environment.OPENCODE_START_TIMEOUT_MS ?? 30_000),
    });
    const store = new PostgresRunStore(database);
    const budgetAuthority = new BudgetAuthority({
      store: new PostgresBudgetStore(database),
      estimator: new InvocationEstimator({
        pricingCatalog: new RoutingPricingCatalog(routingConfiguration.aliases, environment),
        safetyMargin: Number(environment.HARNESS_RESERVATION_SAFETY_MARGIN ?? 1.2),
      }),
      reservation: { maxOutputTokens: Number(environment.HARNESS_RESERVATION_OUTPUT_TOKENS ?? 4096) },
    });
    const processRunner = new ProcessRunner();
    const scannerBundleAttestor = new ScannerBundleAttestor({ manifest: scannerBundle, root: environment.AICP_ROOT ?? "/aicp" });
    const projectAdapter = new ProjectAdapter();
    const workspaceAttestor = new WorkspaceAttestor({ projectRoot: environment.PROJECTS_ROOT ?? "/workspace", environment });
    const gateRegistry = new GateRegistry({ definitions: gateConfiguration.gates })
      .register("project", new ProjectGateProvider())
      .register("semgrep", new ScannerGateProvider("semgrep", ephemeral ? {} : { runner: processRunner, bundleAttestor: scannerBundleAttestor }))
      .register("gitleaks", new ScannerGateProvider("gitleaks", ephemeral ? {} : { runner: processRunner, bundleAttestor: scannerBundleAttestor }))
      .register("trivy", new ScannerGateProvider("trivy", ephemeral ? {} : { runner: processRunner, bundleAttestor: scannerBundleAttestor }));
    const executionPlane = ephemeral
      ? new WorkerExecutionPlane({ workerManager, profileRegistry: workerProfiles })
      : new LocalExecutionPlane({ controller: new OpenCodeController(opencode.client), gateRunner: new ProjectGateRunner({ runner: processRunner }) });
    const handlers = createWorkflowHandlers({
      definition,
      store,
      controller: ephemeral ? null : new OpenCodeController(opencode.client),
      projectAdapter,
      gateRunner: ephemeral ? null : new ProjectGateRunner({ runner: processRunner }),
      executionPlane,
      gateRegistry,
      budgetAuthority,
      routingPolicy: new RoutingPolicy(routingConfiguration, environment),
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
      executionPlane,
      metadata: {
        versions: { workflow: `${definition.name}-v${definition.version}`, policy: "policy-v1", context: `context-schema-v${environment.AICP_CONTEXT_SCHEMA_VERSION ?? "3"}` },
        policies: [{ name: "control-plane", version: "policy-v1" }, { name: "workspace", version: "workspace-v1" }],
        models: Object.entries(routingConfiguration.aliases).map(([alias, route]) => ({ alias, capabilityClass: route.class, deployments: route.deployments.map(({ id, provider, modelEnv }) => ({ id, provider, configured: Boolean(environment[modelEnv]) })) })),
      },
      readiness: async () => {
        const checks = { postgres: "ok", memory: "ok", litellm: "ok", opencode: "ok", workflow: "ok", gateRegistry: "ok", workerManager: ephemeral ? "ok" : "local-long-lived" };
        try { await database.query("SELECT 1"); } catch { checks.postgres = "error"; }
        if (!ephemeral) {
          const scannerProbes = await Promise.all(["semgrep", "gitleaks", "trivy"].map((tool) => processRunner.run(tool, ["--version"], { timeoutMs: 5000 })));
          if (scannerProbes.some((probe) => probe.kind !== "completed" || probe.exitCode !== 0)) checks.gateRegistry = "error";
        }
        if (workerManager) { try { await workerManager.ready(); } catch { checks.workerManager = "error"; } }
        const litellmRoot = environment.LITELLM_URL ?? environment.LITELLM_BASE_URL?.replace(/\/v1\/?$/, "");
        for (const [name, url] of [["memory", environment.MEMORY_SERVICE_URL ? `${environment.MEMORY_SERVICE_URL}/ready` : null], ["litellm", litellmRoot ? `${litellmRoot}/health/readiness` : null]]) {
          if (!url) { checks[name] = "unconfigured"; continue; }
          try { if (!(await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) checks[name] = "error"; } catch { checks[name] = "error"; }
        }
        return { status: Object.values(checks).some((value) => value === "error") ? "not_ready" : "ready", checks, versions: { workflow: `${definition.name}-v${definition.version}`, policy: "policy-v1", context: `context-schema-v${environment.AICP_CONTEXT_SCHEMA_VERSION ?? "3"}` } };
      },
      capabilities: async ({ project }) => {
        if (!project) return { items: Object.keys(projectAdapter.adapters).sort().map((adapter) => ({ adapter })) };
        return projectAdapter.detect(project);
      },
      preflight: async (task) => {
        const project = task.metadata.projectDirectory;
        const names = [...new Set(Object.values(definition.states).flatMap((state) => state.gates ?? []))];
        if (ephemeral) {
          if (!task.metadata.workerProfile && !task.metadata.projectKind) throw new Error("EPHEMERAL_WORKER_PROFILE_REQUIRED");
          if (!task.metadata.projectProfile) throw new Error("EPHEMERAL_PROJECT_PROFILE_REQUIRED");
          if (!project) throw new TypeError("task metadata.projectDirectory is required");
          return;
        }
        await workspaceAttestor.attest(project);
        const profile = await projectAdapter.detect(project);
        await gateRegistry.preflight({ names, project, profile });
      },
      executionPlane,
    });
    return {
      runtime,
      async close() {
        opencode?.server.close();
        await database.end();
      },
    };
  } catch (error) {
    opencode?.server.close();
    await database.end();
    throw error;
  }
}
