#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
cli_package="${2:-${AICP_RUNTIME_CLI_PACKAGE:-}}"
cli_version="${3:-${AICP_RUNTIME_CLI_VERSION:-}}"
case "$provider" in
  codex|claude|opencode) ;;
  *) echo "unsupported provider: $provider" >&2; exit 2 ;;
esac
if [[ "$provider" != opencode && ( -z "$cli_package" || -z "$cli_version" ) ]]; then
  echo "provider CLI package and version are required; latest is forbidden" >&2
  exit 2
fi
cli_package="${cli_package:-opencode-ai}"
cli_version="${cli_version:-1.18.21}"
[[ "$cli_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo "exact CLI version is required" >&2; exit 2; }
case "$provider:$cli_package" in codex:@openai/codex|claude:@anthropic-ai/claude-code|opencode:opencode-ai) ;; *) echo "official provider package is required" >&2; exit 2 ;; esac
image="aicp-runtime-${provider}:candidate-${cli_version}"
docker build --file "$root/runtime/$provider/Dockerfile" --tag "$image" \
  --build-arg "CLI_PACKAGE=$cli_package" --build-arg "CLI_VERSION=$cli_version" \
  "$root"
digest="$(docker image inspect --format '{{.Id}}' "$image" | sed 's/^sha256:/sha256:/')"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "candidate image digest unavailable" >&2; exit 1; }
mkdir -p "$root/.aicp/evidence/runtime/$provider"
printf '%s\n' "$image" > "$root/.aicp/evidence/runtime/$provider/image.txt"
printf '%s\n' "$digest" > "$root/.aicp/evidence/runtime/$provider/image-digest.txt"
printf '%s\n' "$cli_version" > "$root/.aicp/evidence/runtime/$provider/cli-version.txt"
printf '%s\n' "candidate" > "$root/.aicp/evidence/runtime/$provider/status.txt"
echo "$image"
