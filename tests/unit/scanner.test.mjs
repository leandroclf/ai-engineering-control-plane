import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFinding } from "../../harness/src/scanners/normalize-finding.mjs";

test("finding normalization redacts secret material and produces stable fingerprint", () => {
  const input = {
    ruleId: "secret.generic",
    severity: "HIGH",
    category: "secret",
    path: "config.js",
    line: 4,
    message: "token fixture-sensitive-material",
    secret: "fixture-sensitive-material",
  };
  const first = normalizeFinding("gitleaks", input);
  const second = normalizeFinding("gitleaks", input);

  assert.equal(first.message.includes(input.secret), false);
  assert.match(first.fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.fingerprint, second.fingerprint);
});
