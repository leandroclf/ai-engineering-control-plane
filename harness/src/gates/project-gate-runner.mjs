import { CommandGate } from "./command-gate.mjs";
import { ScannerCommandGate } from "./scanner-command-gate.mjs";

export class ProjectGateRunner {
  constructor({ runner, maxOutputBytes = 16_384 }) {
    this.gate = new CommandGate({ runner, maxOutputBytes });
    this.scannerGate = new ScannerCommandGate({ runner });
  }

  async run({ project, profile, gateNames = null, definitions = null }) {
    const available = profile.gates ?? Object.entries(profile.capabilities ?? {}).filter(([, value]) => value).map(([name, value]) => ({ name, ...value }));
    const selected = definitions ?? (gateNames ? gateNames.map((name) => available.find((gate) => gate.name === name) ?? { name, required: true, command: null }) : available);
    const gates = [];
    for (const definition of selected) {
      gates.push(await (definition.scanner ? this.scannerGate : this.gate).evaluate({
        name: definition.name,
        required: definition.required,
        command: definition.command,
        cwd: project,
        timeoutMs: definition.timeoutMs,
        scanner: definition.scanner,
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
