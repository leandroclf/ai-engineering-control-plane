export class SelfHealing {
  constructor({ patterns = [], learn = async () => {} } = {}) { this.patterns = patterns; this.learn = learn; }
  async recover({ error, step, attempt, context }) {
    const match = this.patterns.find((pattern) => pattern.signature?.test?.(error) || pattern.code === error.code);
    if (!match || attempt > (match.maxRetries ?? 1)) return { retry: false, reason: "NO_VALIDATED_RECOVERY" };
    const outcome = await match.recovery({ error, step, context });
    await this.learn({ status: "EXPERIMENTAL", pattern: match.name, outcome, attempt, traceId: context.traceId });
    return { retry: outcome?.retry === true, pattern: match.name };
  }
}
