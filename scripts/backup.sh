#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$root"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"; destination="${1:-./backups/$stamp}"
mkdir -p "$destination"; chmod 700 "$destination"
for database in aicp_memory litellm; do
  docker compose exec -T postgres pg_dump --username aicp --format=custom "$database" > "$destination/$database.dump"
done
tar -C opencode -czf "$destination/opencode-config.tar.gz" .
sha256sum "$destination"/* > "$destination/SHA256SUMS"
printf '%s\n' "$destination"
