import { createHash } from "node:crypto";

import { compileContextPackage } from "../../../context/compiler/context-package.mjs";

export class GovernedContextProvider {
  constructor({ memoryClient }) {
    this.memoryClient = memoryClient;
  }

  async load({ taskId, authorizedScopes, budget }) {
    const allowed = new Set(authorizedScopes);
    const memories = await this.memoryClient.search({ scopes: authorizedScopes });
    const candidates = memories
      .filter((memory) => memory.status === "ACTIVE" && allowed.has(memory.scope))
      .map((memory) => ({
        id: `memory:${memory.id}`,
        priority: 4,
        tokens: Math.max(1, Math.ceil(memory.summary.length / 4)),
        contentHash: createHash("sha256").update(memory.summary).digest("hex"),
        content: memory.summary,
        reason: "scoped-memory",
        provenance: { memoryId: memory.id, scope: memory.scope },
      }));
    return compileContextPackage({ taskId, candidates, budget });
  }
}
