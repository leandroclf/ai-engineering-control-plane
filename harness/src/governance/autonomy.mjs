export const AUTONOMY_LEVELS = Object.freeze({ READ_ONLY: 0, SAFE_EXECUTION: 1, REVERSIBLE_CHANGE: 2, SENSITIVE_OPERATION: 3 });
export class AutonomyPolicy {
  constructor(level = 0) { if (![0, 1, 2, 3].includes(level)) throw new Error("AUTONOMY_LEVEL_INVALID"); this.level = level; }
  authorize(requiredLevel, { humanApproval = false } = {}) {
    if (requiredLevel === 3 && !humanApproval) throw new Error("HUMAN_APPROVAL_REQUIRED");
    if (requiredLevel > this.level) throw new Error("AUTONOMY_LEVEL_DENIED");
    return true;
  }
}
