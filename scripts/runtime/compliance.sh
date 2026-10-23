#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
container="${2:?running container id is required}"
out="$root/.aicp/evidence/runtime/$provider"
mkdir -p "$out"
inspect="$out/inspect.json"
docker inspect "$container" > "$inspect"
jq -e '.[0].Config.User != null and .[0].Config.User != "0" and .[0].Config.User != "root"' "$inspect" >/dev/null
jq -e '.[0].HostConfig.ReadonlyRootfs == true' "$inspect" >/dev/null
jq -e '.[0].Mounts | all(.[]; .Destination != "/var/run/docker.sock" and .Destination != "/root/.ssh")' "$inspect" >/dev/null
jq -e '.[0].Config.Env | any(. == "HOME=/run/aicp-home")' "$inspect" >/dev/null
jq -e '.[0].HostConfig.Tmpfs | has("/run/aicp-home")' "$inspect" >/dev/null
if docker exec "$container" sh -c 'touch /aicp-rootfs-write-test' >/dev/null 2>&1; then
  echo 'root filesystem is writable' >&2
  exit 1
fi
docker exec "$container" sh -c 'test -w /workspace/project'
docker exec "$container" sh -c 'test ! -S /var/run/docker.sock'
printf '%s\n' 'runtime-compliance=PASS' > "$out/compliance.log"
printf '%s\n' "provider=$provider" >> "$out/compliance.log"
printf '%s\n' "container=$container" >> "$out/compliance.log"
