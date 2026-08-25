export function providerExecutionRecord(database, { request, result, status = "completed", terminationReason = null, beforeTree = null, afterTree = null }) {
  const value = (item) => item === undefined ? null : item;
  const provider = result.provider ?? {};
  const usage = result.usage ?? {};
  const executionId = result.executionId ?? request.invocation.logicalInvocationId;
  return database.query(`INSERT INTO control.agent_provider_executions(execution_id,logical_invocation_id,reservation_id,task_id,run_id,stage,provider_id,provider_family,runtime,auth_mode,billing_mode,status,termination_reason,input_tokens,output_tokens,cached_input_tokens,provider_reported_cost_usd,monetary_cost_known,agent_turns,wall_time_ms,mutation_started,before_tree,after_tree,metadata,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,now()) ON CONFLICT(execution_id) DO UPDATE SET status=EXCLUDED.status,termination_reason=EXCLUDED.termination_reason,completed_at=now()`, [executionId, request.invocation.logicalInvocationId, value(request.invocation.reservationId), request.invocation.taskId, request.invocation.runId, request.invocation.stage, provider.providerId ?? "unknown", provider.providerFamily ?? "unknown", provider.runtime ?? "unknown", provider.authMode ?? "unknown", provider.billingMode ?? usage.billingMode ?? "unknown", status, terminationReason ?? result.terminationReason ?? "completed", value(usage.inputTokens), value(usage.outputTokens), value(usage.cachedInputTokens), value(usage.providerReportedCostUsd), usage.monetaryCostKnown === true, value(usage.agentTurns), value(usage.wallTimeMs), result.mutation?.started === true, beforeTree, afterTree, JSON.stringify({ providerAttempts: result.providerAttempts ?? [] })]);
  return executionId;
}

export function providerExecutionsByRun(database, runId) {
  return database.query("SELECT execution_id,logical_invocation_id,task_id,run_id,stage,provider_id,provider_family,runtime,auth_mode,billing_mode,status,termination_reason,input_tokens,output_tokens,cached_input_tokens,provider_reported_cost_usd,monetary_cost_known,agent_turns,wall_time_ms,mutation_started,before_tree,after_tree,created_at,completed_at FROM control.agent_provider_executions WHERE run_id=$1 ORDER BY created_at", [runId]);
}
