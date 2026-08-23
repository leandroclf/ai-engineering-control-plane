ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
FROM ${NODE_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /aicp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY harness ./harness
COPY docker/worker-manager/entrypoint.sh /usr/local/bin/aicp-worker-manager-entrypoint
RUN chmod 755 /usr/local/bin/aicp-worker-manager-entrypoint

USER node
ENTRYPOINT ["/usr/local/bin/aicp-worker-manager-entrypoint"]
CMD ["node", "harness/src/workers/worker-manager-server.mjs"]
