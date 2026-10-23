#!/bin/sh
set -eu

if [ "${AICP_EXTENSION_POLICY:-STRICT}" = "STRICT" ]; then
  export AICP_NATIVE_SKILLS=forbidden
  export AICP_PLUGINS=forbidden
  export AICP_MCP_AUTO_DISCOVERY=forbidden
fi

exec "$@"
