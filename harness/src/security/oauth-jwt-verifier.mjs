import { createPublicKey, verify as verifySignature } from "node:crypto";

function decodePart(value) { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); }

export class JwksCache {
  constructor({ uri, fetcher = fetch, ttlMs = 300_000 } = {}) {
    if (!uri) throw new TypeError("JWKS URI is required");
    this.uri = uri; this.fetcher = fetcher; this.ttlMs = ttlMs; this.value = null; this.expiresAt = 0;
  }

  async get() {
    if (this.value && this.expiresAt > Date.now()) return this.value;
    const response = await this.fetcher(this.uri, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`JWKS_UNAVAILABLE:${response.status}`);
    const value = await response.json();
    if (!Array.isArray(value.keys)) throw new Error("JWKS_INVALID");
    this.value = value; this.expiresAt = Date.now() + this.ttlMs;
    return value;
  }
}

export class OAuthJwtVerifier {
  constructor({ issuer, audience, jwks, allowedAlgorithms = ["RS256"], clockToleranceSeconds = 60, expectedType = "at+jwt" }) {
    if (!issuer || !audience || !jwks?.get) throw new TypeError("OAuth issuer, audience and JWKS cache are required");
    this.issuer = issuer; this.audience = audience; this.jwks = jwks; this.allowedAlgorithms = new Set(allowedAlgorithms); this.clockToleranceSeconds = clockToleranceSeconds; this.expectedType = expectedType;
  }

  async verify(token) {
    const parts = String(token).split(".");
    if (parts.length !== 3) throw new Error("JWT_INVALID");
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodePart(encodedHeader); const claims = decodePart(encodedPayload);
    if (!this.allowedAlgorithms.has(header.alg) || (this.expectedType && header.typ !== this.expectedType)) throw new Error("JWT_HEADER_INVALID");
    const key = (await this.jwks.get()).keys.find((candidate) => candidate.kid === header.kid && candidate.alg === header.alg);
    if (!key) throw new Error("JWT_KEY_NOT_FOUND");
    const publicKey = createPublicKey({ key, format: "jwk" });
    const valid = verifySignature("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, Buffer.from(encodedSignature, "base64url"));
    if (!valid) throw new Error("JWT_SIGNATURE_INVALID");
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== this.issuer || !(Array.isArray(claims.aud) ? claims.aud.includes(this.audience) : claims.aud === this.audience) || !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= now - this.clockToleranceSeconds || (claims.nbf && claims.nbf > now + this.clockToleranceSeconds)) throw new Error("JWT_CLAIMS_INVALID");
    const scopes = typeof claims.scope === "string" ? claims.scope.split(/\s+/).filter(Boolean) : [];
    const roles = [...new Set([...(Array.isArray(claims.roles) ? claims.roles : []), ...(scopes.includes("aicp:admin") ? ["admin"] : []), ...(scopes.includes("aicp:operator") ? ["operator"] : []), ...(scopes.includes("aicp:viewer") ? ["viewer"] : [])])];
    if (!roles.length) throw new Error("JWT_ROLES_MISSING");
    return Object.freeze({ ...claims, roles, scopes });
  }
}
