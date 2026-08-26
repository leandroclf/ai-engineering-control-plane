FROM gradle:8-jdk21@sha256:66e8f1cd9019bb5dbc9084ebdc1717251db6479ac810ae80fe8fcf236c8d6ce9
ARG OPENCODE_VERSION=1.18.21
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/bash worker
ENV GRADLE_USER_HOME=/tmp/gradle-home
USER worker
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]
