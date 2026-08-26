#!/usr/bin/env bash
set -euo pipefail

provider="${1:?provider is required}"
image="${2:?image is required}"
volume="${3:?provider-owned Docker volume is required}"
action="${4:?action is required: login|status|logout}"

case "$provider:$action" in
  codex:login) command_args=(codex login --device-auth) ;;
  codex:status) command_args=(codex login status) ;;
  codex:logout) command_args=(codex logout) ;;
  codex:probe) command_args=(codex exec --json --ephemeral --sandbox read-only --skip-git-repo-check "Reply exactly OK") ;;
  claude:login) command_args=(claude auth login) ;;
  claude:status) command_args=(claude auth status) ;;
  claude:logout) command_args=(claude auth logout) ;;
  claude:probe) command_args=(claude --print --output-format json --tools "" --no-session-persistence "Reply exactly OK") ;;
  opencode:login) command_args=(opencode auth login --provider "OpenCode Zen") ;;
  opencode:status) command_args=(opencode auth list) ;;
  opencode:logout) command_args=(opencode auth logout) ;;
  opencode:probe) command_args=(opencode run --pure --format json "Reply exactly OK") ;;
  *) echo "unsupported provider/action: $provider/$action" >&2; exit 2 ;;
esac

docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
docker run --rm --user 0:0 --network none \
  --mount "type=volume,src=$volume,dst=/run/aicp-auth" \
  --entrypoint sh "$image" \
  -c 'mkdir -p /run/aicp-auth/codex /run/aicp-auth/claude /run/aicp-auth/.local/share/opencode && chown -R 10001:10001 /run/aicp-auth'

env_args=(
  --env HOME=/run/aicp-auth
  --env AICP_EXTENSION_POLICY=STRICT
  --env AICP_NATIVE_SKILLS=forbidden
  --env AICP_PLUGINS=forbidden
  --env AICP_MCP_AUTO_DISCOVERY=forbidden
)
case "$provider" in
  codex) env_args+=(--env CODEX_HOME=/run/aicp-auth/codex) ;;
  claude) env_args+=(--env CLAUDE_CONFIG_DIR=/run/aicp-auth/claude) ;;
esac

docker run --rm --interactive --tty \
  --user 10001:10001 \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --network bridge \
  --mount "type=volume,src=$volume,dst=/run/aicp-auth" \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  "${env_args[@]}" \
  "$image" "${command_args[@]}"
