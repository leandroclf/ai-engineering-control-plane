#!/usr/bin/env node
import process from "node:process";

import { parseRuntimeArguments, resolveProjectDirectory } from "./runtime-arguments.mjs";
import { createHarnessServer } from "../runtime/http-server.mjs";
import { createProductionRuntime } from "../runtime/production-runtime.mjs";
import { ControlPlaneAuthorizer } from "../security/identity-authority.mjs";
import { JwksCache, OAuthJwtVerifier } from "../security/oauth-jwt-verifier.mjs";

const projectsRoot = process.env.PROJECTS_ROOT ?? "/workspace/projects";
let resources;

async function close() {
  await resources?.close();
}

try {
  resources = await createProductionRuntime();
  if (process.argv[2] === "serve") {
    const oauth = process.env.AICP_AUTH_MODE === "oauth";
    if (process.env.AICP_RELEASE_MODE === "production" && !oauth) throw new Error("PRODUCTION_REQUIRES_OAUTH_AUTH");
    const authorizer = oauth ? new ControlPlaneAuthorizer({ jwtVerifier: new OAuthJwtVerifier({
      issuer: process.env.AICP_OAUTH_ISSUER,
      audience: process.env.AICP_OAUTH_AUDIENCE,
      jwks: new JwksCache({ uri: process.env.AICP_OAUTH_JWKS_URI }),
      allowedAlgorithms: (process.env.AICP_OAUTH_ALGORITHMS ?? "RS256").split(","),
    }) }) : null;
    const server = createHarnessServer({
      runtime: resources.runtime,
      token: process.env.HARNESS_SERVICE_TOKEN,
      authorizer,
      projectsRoot,
      capabilityRouter: resources.capabilityRouter,
      skillRegistry: resources.skillRegistry,
      metrics: resources.metrics,
    });
    const port = Number(process.env.HARNESS_PORT ?? 8081);
    server.listen(port, "0.0.0.0", () => process.stdout.write(`aicp harness listening on 0.0.0.0:${port}\n`));
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => server.close(() => close().finally(() => process.exit(0))));
    }
  } else {
    const command = parseRuntimeArguments(process.argv.slice(2));
    const result = command.command === "resume"
      ? await resources.runtime.resume(command.runId)
      : await resources.runtime.start({
        idempotencyKey: command.idempotencyKey,
        metadata: {
          projectDirectory: resolveProjectDirectory(projectsRoot, command.project),
          query: command.query,
          repository: command.repository,
          scopes: command.scopes,
          ...(command.providerId ? { providerId: command.providerId } : {}),
        },
      });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    await close();
  }
} catch (error) {
  process.stderr.write(`harness runtime failed: ${error.message}\n`);
  await close();
  process.exitCode = 1;
}
