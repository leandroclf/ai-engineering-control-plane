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
      .register("semgrep", new ScannerGateProvider("semgrep", { runner: processRunner, bundleAttestor: scannerBundleAttestor }))
      .register("gitleaks", new ScannerGateProvider("gitleaks", { runner: processRunner, bundleAttestor: scannerBundleAttestor }))
      .register("trivy", new ScannerGateProvider("trivy", { runner: processRunner, bundleAttestor: scannerBundleAttestor }));
    const handlers = createWorkflowHandlers({
      definition,
      store,
      controller: new OpenCodeController(opencode.client),
      projectAdapter,
      gateRunner: new ProjectGateRunner({ runner: processRunner }),
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
      metadata: {
        versions: { workflow: `${definition.name}-v${definition.version}`, policy: "policy-v1", context: "context-v2" },
        policies: [{ name: "control-plane", version: "policy-v1" }, { name: "workspace", version: "workspace-v1" }],
        models: Object.entries(routingConfiguration.aliases).map(([alias, route]) => ({ alias, capabilityClass: route.class, deployments: route.deployments.map(({ id, provider, modelEnv }) => ({ id, provider, configured: Boolean(environment[modelEnv]) })) })),
      },
      readiness: async () => {
        const checks = { postgres: "ok", memory: "ok", litellm: "ok", opencode: "ok", workflow: "ok", gateRegistry: "ok" };
        try { await database.query("SELECT 1"); } catch { checks.postgres = "error"; }
        const scannerProbes = await Promise.all(["semgrep", "gitleaks", "trivy"].map((tool) => processRunner.run(tool, ["--version"], { timeoutMs: 5000 })));
        if (scannerProbes.some((probe) => probe.kind !== "completed" || probe.exitCode !== 0)) checks.gateRegistry = "error";
        const litellmRoot = environment.LITELLM_URL ?? environment.LITELLM_BASE_URL?.replace(/\/v1\/?$/, "");
        for (const [name, url] of [["memory", environment.MEMORY_SERVICE_URL ? `${environment.MEMORY_SERVICE_URL}/ready` : null], ["litellm", litellmRoot ? `${litellmRoot}/health/readiness` : null]]) {
          if (!url) { checks[name] = "unconfigured"; continue; }
          try { if (!(await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) checks[name] = "error"; } catch { checks[name] = "error"; }
        }
        return { status: Object.values(checks).some((value) => value === "error") ? "not_ready" : "ready", checks, versions: { workflow: `${definition.name}-v${definition.version}`, policy: "policy-v1", context: "context-v2" } };
      },
      capabilities: async ({ project }) => {
        if (!project) return { items: Object.keys(projectAdapter.adapters).sort().map((adapter) => ({ adapter })) };
        return projectAdapter.detect(project);
      },
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
