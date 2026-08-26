#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
image="${2:?immutable image reference is required}"
cli_version="${3:?validated CLI version is required}"
manifest="$root/runtime-manifests/$provider.json"
out="$root/.aicp/evidence/runtime/$provider"
[[ -f "$out/compliance.log" ]] && grep -q 'runtime-compliance=PASS' "$out/compliance.log" || { echo 'compliance evidence is required' >&2; exit 1; }
[[ -f "$out/contract-test.log" ]] || { echo 'contract evidence is required' >&2; exit 1; }
[[ -f "$out/adversarial-test.log" ]] || { echo 'adversarial evidence is required' >&2; exit 1; }
[[ -f "$out/auth-test.log" ]] && grep -q '^provider-auth=PASS$' "$out/auth-test.log" || { echo 'live provider auth evidence is required' >&2; exit 1; }
[[ -f "$out/execution-test.log" ]] && grep -q '^provider-execution=PASS$' "$out/execution-test.log" || { echo 'live provider execution evidence is required' >&2; exit 1; }
digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "$image" | sed 's/.*@//')"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'promotion requires an immutable repo digest' >&2; exit 1; }
node --input-type=module - "$manifest" "$image" "$digest" "$cli_version" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [path, image, digest, cliVersion] = process.argv.slice(2);
const previous = JSON.parse(await readFile(path, "utf8"));
const next = { ...previous, status: "VALIDATED", cliVersion, image, digest, validatedAt: new Date().toISOString(), authModeValidated: true, executionModeValidated: true, rollbackDigest: previous.digest ?? previous.rollbackDigest ?? null, limitation: null };
await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ provider: next.provider, status: next.status, digest: next.digest, rollbackDigest: next.rollbackDigest })}\n`);
NODE
