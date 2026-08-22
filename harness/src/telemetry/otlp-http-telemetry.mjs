import { createHash } from "node:crypto";

const ALLOWED = ["taskId", "runId", "stage", "outcome", "contextId"];
const stableSpanId = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 16);

function attribute(key, value) {
  return { key: `aicp.${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, value: { stringValue: String(value) } };
}

function rawAttribute(key, value, type = "stringValue") {
  return { key, value: { [type]: type === "intValue" ? String(value) : value } };
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
    const end = (finished > started ? finished : started + 1n).toString();
    const traceId = createHash("sha256").update(String(metadata.runId)).digest("hex").slice(0, 32);
    const attributes = ALLOWED.filter((key) => metadata[key] !== undefined).map((key) => attribute(key, metadata[key]));
    if (metadata.usage) {
      attributes.push(rawAttribute("gen_ai.usage.input_tokens", metadata.usage.inputTokens ?? 0, "intValue"));
      attributes.push(rawAttribute("gen_ai.usage.output_tokens", metadata.usage.outputTokens ?? 0, "intValue"));
      attributes.push(rawAttribute("aicp.cost_usd", Number(metadata.usage.costUsd ?? 0), "doubleValue"));
    }
    if (metadata.budget) {
      attributes.push(attribute("budgetReservationId", metadata.budget.reservationId));
      attributes.push(rawAttribute("aicp.budget.reserved_cost_usd", Number(metadata.budget.reservedCostUsd ?? 0), "doubleValue"));
      attributes.push(rawAttribute("aicp.budget.drift_cost_ratio", Number(metadata.budget.drift?.costRatio ?? 0), "doubleValue"));
    }

    const runSpanId = stableSpanId(`run:${metadata.runId}`);
    const stageSpanId = stableSpanId(`stage:${metadata.runId}:${metadata.stage}:${metadata.attempt ?? 1}`);
    const span = (name, suffix, parentSpanId, extra = [], status = 1) => ({
      traceId, spanId: stableSpanId(`${stageSpanId}:${suffix}`), parentSpanId, name,
      startTimeUnixNano: started.toString(), endTimeUnixNano: end, attributes: extra, status: { code: status },
    });
    const spans = [
      { traceId, spanId: runSpanId, name: "aicp.run", startTimeUnixNano: started.toString(), endTimeUnixNano: end,
        attributes: [attribute("runId", metadata.runId), attribute("taskId", metadata.taskId), attribute("contentRecorded", false), attribute("redactionPolicy", "aicp-redaction-v1")], status: { code: 1 } },
      { traceId, spanId: stageSpanId, parentSpanId: runSpanId, name: `aicp.stage.${metadata.stage}`,
        startTimeUnixNano: started.toString(), endTimeUnixNano: end, attributes, status: { code: metadata.outcome === "pass" ? 1 : 0 } },
    ];

    if (metadata.contextId) {
      const context = span("aicp.context.compile", "context", stageSpanId, [attribute("contextId", metadata.contextId), attribute("vectorSkipped", metadata.contextMetrics?.vector_skipped ?? false)]);
      spans.push(context);
      for (const source of ["exact", "lexical", "vector", "graph"]) {
        if (source !== "vector" || metadata.contextMetrics?.vector_skipped !== true) spans.push(span(`aicp.retrieval.${source}`, `retrieval:${source}`, context.spanId));
      }
      spans.push(span("aicp.context.pack", "context:pack", context.spanId));
      if ((metadata.contextMetrics?.memory_hits ?? 0) > 0) spans.push(span("aicp.memory.retrieve", "memory", context.spanId, [rawAttribute("aicp.memory.hits", metadata.contextMetrics.memory_hits, "intValue")]));
    }
    if (metadata.usage) {
      const agent = span("aicp.agent.invoke", "agent", stageSpanId, [attribute("agent", metadata.agent ?? metadata.stage), attribute("attempt", metadata.attempt ?? 1)]);
      const generation = span("gen_ai.chat", "gen-ai", agent.spanId, [
        rawAttribute("gen_ai.usage.input_tokens", metadata.usage.inputTokens ?? 0, "intValue"),
        rawAttribute("gen_ai.usage.output_tokens", metadata.usage.outputTokens ?? 0, "intValue"),
        ...(metadata.usage.provider ? [rawAttribute("gen_ai.provider.name", String(metadata.usage.provider))] : []),
        ...(metadata.usage.model ? [rawAttribute("gen_ai.response.model", String(metadata.usage.model))] : []),
      ]);
      spans.push(agent, generation);
      for (const attempt of metadata.usage.providerAttempts ?? []) {
        spans.push(span(attempt.fallback ? "aicp.provider.fallback" : "aicp.provider.attempt", `provider:${attempt.attempt}`, generation.spanId, [
          attribute("physicalAttempt", attempt.attempt), attribute("logicalInvocationId", metadata.budget?.logicalInvocationId ?? "unknown"),
          rawAttribute("gen_ai.provider.name", String(attempt.provider)), rawAttribute("gen_ai.response.model", String(attempt.model)),
          rawAttribute("gen_ai.usage.input_tokens", attempt.inputTokens ?? 0, "intValue"), rawAttribute("gen_ai.usage.output_tokens", attempt.outputTokens ?? 0, "intValue"),
          rawAttribute("aicp.cost_usd", Number(attempt.costUsd ?? 0), "doubleValue"),
        ], attempt.status === "failed" ? 2 : 1));
      }
    }
    if (metadata.budget) spans.push(span("aicp.budget.commit", "budget", stageSpanId, [attribute("budgetReservationId", metadata.budget.reservationId), attribute("logicalInvocationId", metadata.budget.logicalInvocationId ?? "unknown")]));
    if (/gate|verify|test|review|scan|security/i.test(metadata.stage)) spans.push(span(`aicp.gate.${metadata.stage}`, "gate", stageSpanId, [attribute("outcome", metadata.outcome)]));

    const body = { resourceSpans: [{
      resource: { attributes: [rawAttribute("service.name", this.serviceName), rawAttribute("aicp.event_schema", "aicp.telemetry.v1")] },
      scopeSpans: [{ scope: { name: "aicp.telemetry", version: "1" }, spans }],
    }] };
    try {
      const response = await this.transport(`${this.endpoint}/v1/traces`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const metricAttributes = ["stage", "outcome"].map((key) => attribute(key, metadata[key]));
      const sum = (name, value, unit = "1") => ({ name, unit, sum: { aggregationTemporality: 1, isMonotonic: true, dataPoints: [{ asDouble: Number(value), timeUnixNano: end, attributes: metricAttributes }] } });
      const histogram = (name, value, unit) => ({ name, unit, histogram: { aggregationTemporality: 1, dataPoints: [{ count: "1", sum: Number(value), timeUnixNano: end, attributes: metricAttributes }] } });
      const metrics = [
        sum("aicp_agent_calls_total", metadata.usage ? 1 : 0), histogram("aicp_stage_duration_seconds", Number(finished - started) / 1e9, "s"),
        sum("aicp_task_input_tokens", metadata.usage?.inputTokens ?? 0, "token"), sum("aicp_task_output_tokens", metadata.usage?.outputTokens ?? 0, "token"),
        sum("aicp_task_cost_usd", metadata.usage?.costUsd ?? 0, "USD"), sum("aicp_budget_overshoot_total", metadata.budget?.drift?.exceeded ? 1 : 0),
        histogram("aicp_budget_reservation_drift_ratio", metadata.budget?.drift?.costRatio ?? 0, "1"),
        sum("aicp_context_candidate_tokens", metadata.contextMetrics?.candidate_tokens ?? 0, "token"), sum("aicp_context_selected_tokens", metadata.contextMetrics?.selected_tokens ?? 0, "token"),
        sum("aicp_context_dedup_saved_tokens", metadata.contextMetrics?.dedup_saved_tokens ?? 0, "token"), sum("aicp_context_vector_skipped_total", metadata.contextMetrics?.vector_skipped ? 1 : 0),
      ];
      await this.transport(`${this.endpoint}/v1/metrics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceMetrics: [{ resource: { attributes: [rawAttribute("service.name", this.serviceName)] }, scopeMetrics: [{ scope: { name: "aicp.telemetry", version: "1" }, metrics }] }] }) }).catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  }
}
