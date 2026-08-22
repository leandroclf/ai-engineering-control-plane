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
  }

  async stage(metadata) {
    if (!this.endpoint) return false;
    const started = BigInt(Date.now()) * 1_000_000n;
    const traceId = createHash("sha256").update(String(metadata.taskId)).digest("hex").slice(0, 32);
    const attributes = ALLOWED.filter((key) => metadata[key] !== undefined).map((key) => attribute(key, metadata[key]));
    const body = {
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }] },
        scopeSpans: [{ scope: { name: "aicp.telemetry" }, spans: [{
          traceId,
          spanId: randomBytes(8).toString("hex"),
          name: `workflow.${metadata.stage}`,
          startTimeUnixNano: started.toString(),
          endTimeUnixNano: (started + 1n).toString(),
          attributes,
          status: { code: metadata.outcome === "pass" ? 1 : 0 },
        }] }],
      }],
    };
    try {
      const response = await this.transport(`${this.endpoint}/v1/traces`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
