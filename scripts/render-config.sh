#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
test -f .env.runtime || { echo '.env.runtime not found' >&2; exit 1; }
set -a
source .env.runtime
set +a

required=(CODING_STRONG_MODEL CODING_FAST_MODEL ARCHITECTURE_MODEL SECURITY_MODEL REVIEW_MODEL EMBEDDING_MODEL)
for name in "${required[@]}"; do
  test -n "${!name:-}" || { printf 'missing required variable: %s\n' "$name" >&2; exit 1; }
done

mkdir -p litellm/generated
sed \
  -e "s|\${CODING_STRONG_MODEL}|${CODING_STRONG_MODEL}|g" \
  -e "s|\${CODING_FAST_MODEL}|${CODING_FAST_MODEL}|g" \
  -e "s|\${ARCHITECTURE_MODEL}|${ARCHITECTURE_MODEL}|g" \
  -e "s|\${SECURITY_MODEL}|${SECURITY_MODEL}|g" \
  -e "s|\${REVIEW_MODEL}|${REVIEW_MODEL}|g" \
  -e "s|\${EMBEDDING_MODEL}|${EMBEDDING_MODEL}|g" \
  litellm/config.template.yaml > litellm/generated/config.yaml
