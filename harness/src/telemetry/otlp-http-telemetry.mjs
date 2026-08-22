import { createHash, randomBytes } from "node:crypto";

const ALLOWED = ["taskId", "runId", "stage", "outcome", "contextId"];

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
    const body = {
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }] },
        scopeSpans: [{ scope: { name: "aicp.telemetry" }, spans: [{
          traceId,
          spanId: randomBytes(8).toString("hex"),
          name: `workflow.${metadata.stage}`,
          startTimeUnixNano: started.toString(),
          endTimeUnixNano: (finished > started ? finished : started + 1n).toString(),
          attributes,
          status: { code: metadata.outcome === "pass" ? 1 : 0 },
        }] }],
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
      ];
      await this.transport(`${this.endpoint}/v1/metrics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceMetrics: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }] }, scopeMetrics: [{ scope: { name: "aicp.telemetry" }, metrics }] }] }) }).catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  }
}
