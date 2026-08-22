import { createHash, timingSafeEqual } from "node:crypto";

const ROLE_PERMISSIONS = Object.freeze({
  viewer: new Set(["runs:read", "tasks:read", "platform:read"]),
  operator: new Set(["runs:read", "runs:write", "tasks:read", "budgets:write", "platform:read"]),
  admin: new Set(["*"]),
  worker: new Set(["runs:read", "context:read", "gates:write"]),
});
const digest = (value) => createHash("sha256").update(String(value ?? "")).digest();

export class Principal {
  constructor({ subject, roles, authenticationMethod, workloadId = null }) { this.subject = subject; this.roles = Object.freeze([...roles]); this.authenticationMethod = authenticationMethod; this.workloadId = workloadId; }
  require(permission) {
    if (!this.roles.some((role) => ROLE_PERMISSIONS[role]?.has("*") || ROLE_PERMISSIONS[role]?.has(permission))) throw Object.assign(new Error(`FORBIDDEN:${permission}`), { name: "AuthorizationError", code: "FORBIDDEN" });
  }
}

export class ControlPlaneAuthorizer {
  constructor({ staticToken = null, jwtVerifier = null, trustedClientSubjects = new Map() } = {}) { this.staticToken = staticToken; this.jwtVerifier = jwtVerifier; this.trustedClientSubjects = trustedClientSubjects; }
  async authenticate(request) {
    const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (this.staticToken && bearer && timingSafeEqual(digest(bearer), digest(this.staticToken))) return new Principal({ subject: "service:local", roles: ["admin"], authenticationMethod: "static-token" });
    if (bearer && this.jwtVerifier) {
      const claims = await this.jwtVerifier.verify(bearer);
      if (!claims?.sub || !Array.isArray(claims.roles)) throw new Error("invalid JWT identity claims");
      return new Principal({ subject: claims.sub, roles: claims.roles, authenticationMethod: "oidc-jwt", workloadId: claims.workload_id ?? null });
    }
    const subject = request.socket?.authorized ? request.socket.getPeerCertificate?.().subject?.CN : null;
    if (subject && this.trustedClientSubjects.has(subject)) return new Principal({ subject: `mtls:${subject}`, roles: this.trustedClientSubjects.get(subject), authenticationMethod: "mtls" });
    throw Object.assign(new Error("authentication required"), { name: "AuthenticationError", code: "UNAUTHORIZED" });
  }
}
