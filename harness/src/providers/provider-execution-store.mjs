import { providerExecutionRecord, providerExecutionsByRun } from "../workflow/provider-execution-evidence-store.mjs";

export class PostgresAgentProviderExecutionStore {
  constructor(database) { if (!database?.query) throw new TypeError("database query function is required"); this.database = database; }
  record(input) { return providerExecutionRecord(this.database, input); }
  async listByRun(runId) { return (await providerExecutionsByRun(this.database, runId)).rows; }
}
