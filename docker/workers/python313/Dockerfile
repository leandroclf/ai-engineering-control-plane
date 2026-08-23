ARG PYTHON_IMAGE=python:3.13-slim@sha256:ffb752e139c0a19692a43af8d8523b274222dd68eebad5d583b45c2201c6e30a
FROM ${PYTHON_IMAGE}
ARG OPENCODE_VERSION=1.18.21
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash worker
USER worker
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]
