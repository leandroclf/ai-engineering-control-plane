#!/usr/bin/env bash
set -euo pipefail

runtime_file=".env.runtime"
if test "${1:-}" = "--file"; then
  runtime_file="${2:?usage: configure-local.sh [--file <runtime-env>]}"
elif test "$#" -ne 0; then
  echo 'usage: configure-local.sh [--file <runtime-env>]' >&2
  exit 2
fi

test -f "$runtime_file" || { printf 'runtime file not found: %s\n' "$runtime_file" >&2; exit 1; }
command -v openssl >/dev/null || { echo 'openssl not found' >&2; exit 1; }

set_if_placeholder() {
  local name="$1"
  local replacement="$2"
  local current temporary
  current="$(awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$runtime_file")"
  if test -n "$current" && [[ "$current" != *change-me* && "$current" != *model-id* && "$current" != *MODEL_ID* ]]; then
    return
  fi
  temporary="$(mktemp "${runtime_file}.XXXXXX")"
  awk -v key="$name" -v value="$replacement" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$runtime_file" > "$temporary"
  chmod --reference="$runtime_file" "$temporary"
  mv "$temporary" "$runtime_file"
}

set_if_placeholder CODING_STRONG_MODEL openai/gpt-5.3-codex
set_if_placeholder CODING_FAST_MODEL openai/gpt-5.4-mini
set_if_placeholder ARCHITECTURE_MODEL openai/gpt-5.4
set_if_placeholder SECURITY_MODEL openai/gpt-5.4
set_if_placeholder REVIEW_MODEL openai/gpt-5.4
set_if_placeholder SUMMARIZER_MODEL openai/gpt-5.4-mini
set_if_placeholder EMBEDDING_MODEL openai/text-embedding-3-small

set_if_placeholder LITELLM_MASTER_KEY "sk-$(openssl rand -hex 32)"
set_if_placeholder LITELLM_SALT_KEY "$(openssl rand -hex 32)"
set_if_placeholder NEO4J_AUTH "neo4j/$(openssl rand -hex 24)"

chmod 600 "$runtime_file"
echo '[PASS] local runtime defaults configured without changing provider credentials'
