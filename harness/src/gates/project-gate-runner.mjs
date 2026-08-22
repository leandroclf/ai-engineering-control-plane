import { CommandGate } from "./command-gate.mjs";

export class ProjectGateRunner {
  constructor({ runner, maxOutputBytes = 16_384 }) {
    this.gate = new CommandGate({ runner, maxOutputBytes });
  }

  async run({ project, profile, gateNames = null }) {
    const selected = gateNames
      ? gateNames.map((name) => profile.gates.find((gate) => gate.name === name) ?? { name, required: true, command: null })
      : profile.gates;
    const gates = [];
    for (const definition of selected) {
      gates.push(await this.gate.evaluate({
        name: definition.name,
        required: definition.required,
        command: definition.command,
        cwd: project,
        timeoutMs: definition.timeoutMs,
      }));
    }
    const blocking = gates.some((gate) => gate.status === "fail" || gate.status === "error");
    return {
      schemaVersion: 1,
      projectKind: profile.kind,
      status: blocking ? "blocked" : "pass",
      gates,
    };
  }
}
