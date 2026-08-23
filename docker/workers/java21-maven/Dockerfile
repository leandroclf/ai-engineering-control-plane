FROM maven:3-eclipse-temurin-21@sha256:613124833fa6718ded9d655a2ebfab6425818c178f899116b93560b6f1c9ffe9
ARG OPENCODE_VERSION=1.18.21
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash worker
USER worker
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]
