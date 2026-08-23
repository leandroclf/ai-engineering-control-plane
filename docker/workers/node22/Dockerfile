ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
ARG OPENCODE_VERSION=1.18.21
FROM ${NODE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}"
USER node
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]
