ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
FROM ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f AS gitleaks
FROM aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969 AS trivy
FROM ${NODE_IMAGE}

ARG OPENCODE_VERSION=1.18.21

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && pip3 install --break-system-packages --no-cache-dir semgrep==1.174.0

COPY --from=gitleaks /usr/bin/gitleaks /usr/local/bin/gitleaks
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY opencode /opt/aicp/opencode-base

ENV OPENCODE_CONFIG_DIR=/home/node/.config/opencode
ENV SEMGREP_SEND_METRICS=off
ENV SEMGREP_ENABLE_VERSION_CHECK=0
USER node
WORKDIR /workspace/project
ENTRYPOINT ["sh", "-ec", "mkdir -p /home/node/.config/opencode && cp -a /opt/aicp/opencode-base/. /home/node/.config/opencode/ && exec sleep infinity"]
