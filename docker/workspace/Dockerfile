ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
FROM ${NODE_IMAGE}

ARG OPENCODE_VERSION=1.18.21

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git jq openssh-client python3 ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash dev \
    && install -d -o dev -g dev \
       /home/dev/.cache \
       /home/dev/.config/opencode \
       /home/dev/.local/share/opencode \
       /home/dev/.local/state

USER dev
WORKDIR /workspace
CMD ["sleep", "infinity"]
