import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function signature(secret, payload) { return createHmac("sha256", secret).update(payload).digest("base64url"); }

export class WorkloadIdentityService {
  constructor({ secret, ttlSeconds = 900, now = () => new Date() }) {
    if (!secret || Buffer.byteLength(secret) < 32) throw new TypeError("workload identity signing secret must contain at least 32 bytes");
    this.secret = secret; this.ttlSeconds = ttlSeconds; this.now = now; this.revoked = new Set();
  }

  issue(runId) {
    const payload = Buffer.from(JSON.stringify({ jti: randomUUID(), runId, exp: Math.floor(this.now().getTime() / 1000) + this.ttlSeconds })).toString("base64url");
    return `${payload}.${signature(this.secret, payload)}`;
  }

  verify(token, expectedRunId) {
    const [payload, provided] = String(token).split(".");
    const expected = signature(this.secret, payload ?? "");
    if (!provided || provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) throw new Error("WORKLOAD_IDENTITY_INVALID");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims.runId !== expectedRunId || claims.exp <= Math.floor(this.now().getTime() / 1000) || this.revoked.has(claims.jti)) throw new Error("WORKLOAD_IDENTITY_INVALID");
    return Object.freeze(claims);
  }

  revoke(token) {
    const [payload] = String(token).split(".");
    try { this.revoked.add(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).jti); } catch { /* Invalid tokens are already unusable. */ }
  }
}

