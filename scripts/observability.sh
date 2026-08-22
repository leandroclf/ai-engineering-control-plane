#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
action="${1:-status}"
compose=(docker compose --env-file .env.observability -f compose/observability.vendor.yaml)
case "$action" in
  up) "${compose[@]}" up -d --wait ;;
  down) "${compose[@]}" down ;;
  status) "${compose[@]}" ps ;;
  logs) "${compose[@]}" logs --tail=200 ;;
  *) echo 'usage: observability.sh {up|down|status|logs}' >&2; exit 2 ;;
esac
