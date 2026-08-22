ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE}

ARG OPENCODE_VERSION=1.18.21

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git jq openssh-client python3 ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash dev

USER dev
WORKDIR /workspace
CMD ["sleep", "infinity"]
