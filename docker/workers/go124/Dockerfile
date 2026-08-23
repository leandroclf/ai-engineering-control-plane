FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac
ARG OPENCODE_VERSION=1.18.21
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash worker
USER worker
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]
