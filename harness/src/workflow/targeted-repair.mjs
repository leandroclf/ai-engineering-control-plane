import { ProgressDetector } from "./progress-detector.mjs";

export class TargetedRepair {
  constructor({ maxIterations, repairAgent, runGate, reviewers = [] }) {
    this.maxIterations = maxIterations;
    this.repairAgent = repairAgent;
    this.runGate = runGate;
    this.reviewers = reviewers;
  }

  async execute({ finding, regressionGates }) {
    const progress = new ProgressDetector({ repeatedThreshold: this.maxIterations });
    let currentFinding = finding;
    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const repair = await this.repairAgent({ finding: currentFinding, iteration });
      const originating = await this.runGate(currentFinding.gate);
      if (originating.status === "pass") {
        for (const gate of regressionGates) {
          const result = await this.runGate(gate);
          if (result.status !== "pass") return { status: "human-review", reason: "REGRESSION_GATE_FAILED", gate };
        }
        for (const reviewer of this.reviewers) {
          const result = await reviewer({ readOnly: true, finding: currentFinding });
          if (result.status !== "pass") return { status: "human-review", reason: "REVIEW_BLOCKED" };
        }
        return { status: "repaired", iterations: iteration };
      }
      currentFinding = originating.finding ?? currentFinding;
      const observed = progress.observe({ finding: currentFinding.fingerprint, diff: repair.diffFingerprint });
      if (observed.stop) return { status: "human-review", reason: observed.reason, iterations: iteration };
    }
    return { status: "human-review", reason: "ITERATION_BUDGET_EXHAUSTED", iterations: this.maxIterations };
  }
}
