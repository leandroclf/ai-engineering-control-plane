#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

docker compose exec -T memory-service python - <<'PY'
import json
import os
import urllib.error
import urllib.request

base = "http://127.0.0.1:8080"
token = os.environ.get("MEMORY_SERVICE_TOKEN") or open("/run/secrets/memory_service_token", encoding="utf-8").read()

def call(method, path, body=None):
    request = urllib.request.Request(
        base + path,
        method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

status, created = call("POST", "/v1/memories", {
    "scope": "EXECUTION:local",
    "canonical_key": "validation.memory-api",
    "summary": "Memory API smoke is persistent and idempotent",
    "authority": "CI",
    "kind": "FACT",
    "idempotency_key": "memory-smoke-v1",
})
assert status == 201
if created["status"] == "CANDIDATE":
    status, created = call("POST", f"/v1/memories/{created['id']}:promote", {
        "target_scope": "REPOSITORY:ai-engineering-control-plane",
    })
    assert status == 200
status, result = call("GET", "/v1/memories/search?scope=REPOSITORY:ai-engineering-control-plane")
assert status == 200 and any(item["canonical_key"] == "validation.memory-api" for item in result["items"])
status, _ = call("GET", "/v1/memories/search?scope=PROJECT:unauthorized")
assert status == 403
print("[PASS] persistent scoped memory API")
PY
