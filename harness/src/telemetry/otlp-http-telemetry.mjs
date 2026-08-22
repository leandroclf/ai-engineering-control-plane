import { createHash, randomBytes } from "node:crypto";

const ALLOWED = ["taskId", "runId", "stage", "outcome", "contextId"];
const stableSpanId = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 16);

function attribute(key, value) {
  return { key: `aicp.${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, value: { stringValue: String(value) } };
}

export class OtlpHttpTelemetry {
  constructor({ endpoint, transport = fetch, serviceName = "aicp-harness" }) {
    this.endpoint = endpoint?.replace(/\/$/, "");
    this.transport = transport;
    this.serviceName = serviceName;
    this.acceptsTiming = true;
  }

  async stage(metadata) {
    if (!this.endpoint) return false;
    const started = BigInt(new Date(metadata.startedAt ?? Date.now()).getTime()) * 1_000_000n;
    const finished = BigInt(new Date(metadata.finishedAt ?? Date.now()).getTime()) * 1_000_000n;
    const traceId = createHash("sha256").update(String(metadata.runId)).digest("hex").slice(0, 32);
    const attributes = ALLOWED.filter((key) => metadata[key] !== undefined).map((key) => attribute(key, metadata[key]));
    if (metadata.usage) {
      attributes.push({ key: "gen_ai.usage.input_tokens", value: { intValue: String(metadata.usage.inputTokens ?? 0) } });
      attributes.push({ key: "gen_ai.usage.output_tokens", value: { intValue: String(metadata.usage.outputTokens ?? 0) } });
      attributes.push({ key: "aicp.cost_usd", value: { doubleValue: Number(metadata.usage.costUsd ?? 0) } });
    }
    if (metadata.budget) {
      attributes.push(attribute("budgetReservationId", metadata.budget.reservationId));
      attributes.push({ key: "aicp.budget.reserved_cost_usd", value: { doubleValue: Number(metadata.budget.reservedCostUsd ?? 0) } });
      attributes.push({ key: "aicp.budget.drift_cost_ratio", value: { doubleValue: Number(metadata.budget.drift?.costRatio ?? 0) } });
    }
    const taskSpanId = stableSpanId(`task:${metadata.taskId}`);
    const runSpanId = stableSpanId(`run:${metadata.runId}`);
    const stageSpanId = randomBytes(8).toString("hex");
    const child = (name, suffix, extra = []) => ({ traceId, spanId: stableSpanId(`${stageSpanId}:${suffix}`), parentSpanId: stageSpanId, name, startTimeUnixNano: started.toString(), endTimeUnixNano: (finished > started ? finished : started + 1n).toString(), attributes: extra, status: { code: 1 } });
    const spans = [
      { traceId, spanId: taskSpanId, name: "task", startTimeUnixNano: started.toString(), endTimeUnixNano: (finished > started ? finished : started + 1n).toString(), attributes: [attribute("taskId", metadata.taskId)], status: { code: 1 } },
      { traceId, spanId: runSpanId, parentSpanId: taskSpanId, name: "run", startTimeUnixNano: started.toString(), endTimeUnixNano: (finished > started ? finished : started + 1n).toString(), attributes: [attribute("runId", metadata.runId)], status: { code: 1 } },
      { traceId, spanId: stageSpanId, parentSpanId: runSpanId, name: `stage.${metadata.stage}`, startTimeUnixNano: started.toString(), endTimeUnixNano: (finished > started ? finished : started + 1n).toString(), attributes, status: { code: metadata.outcome === "pass" ? 1 : 0 } },
    ];
    if (metadata.contextId) spans.push(child("context.retrieve", "context", [attribute("contextId", metadata.contextId)]));
    if (metadata.usage) { spans.push(child("agent.invoke", "agent")); spans.push(child("llm.generation", "llm", [{ key: "gen_ai.usage.input_tokens", value: { intValue: String(metadata.usage.inputTokens ?? 0) } }])); }
    if (metadata.budget) spans.push(child("budget.commit", "budget", [attribute("budgetReservationId", metadata.budget.reservationId)]));
    const body = {
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }] },
        scopeSpans: [{ scope: { name: "aicp.telemetry" }, spans }],
      }],
    };
    try {
      const response = await this.transport(`${this.endpoint}/v1/traces`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const at = (finished > started ? finished : started + 1n).toString();
      const metricAttributes = ["stage", "outcome"].map((key) => attribute(key, metadata[key]));
      const sum = (name, value, unit = "1") => ({ name, unit, sum: { aggregationTemporality: 1, isMonotonic: true, dataPoints: [{ asDouble: Number(value), timeUnixNano: at, attributes: metricAttributes }] } });
      const histogram = (name, value, unit) => ({ name, unit, histogram: { aggregationTemporality: 1, dataPoints: [{ count: "1", sum: Number(value), timeUnixNano: at, attributes: metricAttributes }] } });
      const metrics = [
        sum("aicp_agent_calls_total", metadata.usage ? 1 : 0),
        histogram("aicp_stage_duration_seconds", Number(finished - started) / 1e9, "s"),
        sum("aicp_task_input_tokens", metadata.usage?.inputTokens ?? 0, "token"),
        sum("aicp_task_output_tokens", metadata.usage?.outputTokens ?? 0, "token"),
        sum("aicp_task_cost_usd", metadata.usage?.costUsd ?? 0, "USD"),
        sum("aicp_budget_overshoot_total", metadata.budget?.drift?.exceeded ? 1 : 0),
        histogram("aicp_budget_reservation_drift_ratio", metadata.budget?.drift?.costRatio ?? 0, "1"),
        sum("aicp_context_candidate_tokens", metadata.contextMetrics?.candidate_tokens ?? 0, "token"),
        sum("aicp_context_selected_tokens", metadata.contextMetrics?.selected_tokens ?? 0, "token"),
        sum("aicp_context_dedup_saved_tokens", metadata.contextMetrics?.dedup_saved_tokens ?? 0, "token"),
      ];
      await this.transport(`${this.endpoint}/v1/metrics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceMetrics: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }] }, scopeMetrics: [{ scope: { name: "aicp.telemetry" }, metrics }] }] }) }).catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  }
}
