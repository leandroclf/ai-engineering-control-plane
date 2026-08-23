import test from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";

import { JwksCache, OAuthJwtVerifier } from "../../harness/src/security/oauth-jwt-verifier.mjs";

test("OAuth access-token verifier validates issuer audience type signature expiry and roles", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", typ: "at+jwt", kid: "test-key" });
  const payload = encode({ iss: "https://issuer.test", aud: "aicp-control-plane", sub: "user-1", scope: "aicp:operator", exp: Math.floor(Date.now() / 1000) + 300 });
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256"); signer.update(signingInput); signer.end();
  const token = `${signingInput}.${signer.sign(privateKey).toString("base64url")}`;
  const verifier = new OAuthJwtVerifier({ issuer: "https://issuer.test", audience: "aicp-control-plane", jwks: new JwksCache({ uri: "https://issuer.test/.well-known/jwks.json", fetcher: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }) }) });
  const claims = await verifier.verify(token);
  assert.equal(claims.sub, "user-1"); assert.deepEqual(claims.roles, ["operator"]);
  await assert.rejects(verifier.verify(`${header}.${payload}.invalid`), /JWT_SIGNATURE_INVALID/);
});
