import { createHash } from "node:crypto";

import { compileContext } from "./compiler.mjs";

export function compileContextPackage({ taskId, candidates, budget }) {
  const compiled = compileContext({ candidates, budget });
  const identity = JSON.stringify({
    taskId,
    budget,
    artifacts: compiled.artifacts.map(({ id, contentHash, reason, provenance }) => ({ id, contentHash, reason, provenance })),
  });
  return {
    schemaVersion: 1,
    contextId: `ctx_${createHash("sha256").update(identity).digest("hex")}`,
    taskId,
    ...compiled,
  };
}
