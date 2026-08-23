function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function structuredFromOutput(output) {
  const lines = String(output ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const values = lines.map(parseJson).filter(Boolean);
  for (const value of [...values].reverse()) {
    if (value.structured && typeof value.structured === "object") return value.structured;
    const text = value.part?.text ?? value.text ?? value.message?.content;
    const parsed = typeof text === "string" ? parseJson(text) : null;
    if (parsed) return parsed;
  }
  for (const value of [...lines].reverse()) {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start >= 0 && end > start) { const parsed = parseJson(value.slice(start, end + 1)); if (parsed) return parsed; }
  }
  throw new Error("WORKER_AGENT_STRUCTURED_OUTPUT_MISSING");
}

export class WorkerAgentController {
  constructor({ docker, commandPolicy }) {
    if (!docker?.execCapability || !commandPolicy?.validate) throw new TypeError("worker agent execution dependencies are required");
    this.docker = docker;
    this.commandPolicy = commandPolicy;
  }

  async invoke({ workerId, profile, agent, prompt, schema, modelAlias = null }) {
    if (!agent || typeof prompt !== "string" || !schema || typeof schema !== "object") throw new TypeError("worker agent request is invalid");
    const instruction = [
      prompt,
      "Return only one JSON object matching this schema:",
      JSON.stringify(schema),
    ].join("\n\n");
    const args = ["run", "--format", "json", "--agent", agent, "--dir", "/workspace/project", ...(modelAlias ? ["--model", `controlplane/${modelAlias}`] : []), instruction];
    const capability = this.commandPolicy.validate({ profile, capability: "agent:opencode", tool: "opencode", args });
    const result = await this.docker.execCapability(workerId, capability, { cwd: "/workspace/project" });
    if (result.exitCode !== 0) throw new Error(`WORKER_AGENT_FAILED:${String(result.stderr ?? "").slice(0, 500)}`);
    return { structured: structuredFromOutput(result.stdout), usage: result.usage ?? null };
  }
}
