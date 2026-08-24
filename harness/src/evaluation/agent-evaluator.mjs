export class TaskEvaluator {
  constructor({ checks = [] } = {}) { this.checks = checks; }
  async evaluate({ result, observations = [], expected } = {}) {
    const evidence = [];
    for (const check of this.checks) evidence.push(await check({ result, observations, expected }));
    const passed = evidence.every((item) => item?.passed === true) && (this.checks.length > 0 || result?.status === "success");
    return { status: passed ? "ACCEPT" : "RETRY", score: evidence.length ? evidence.filter((item) => item.passed).length / evidence.length : Number(passed), evidence };
  }
}
