FROM gradle:8-jdk21@sha256:66e8f1cd9019bb5dbc9084ebdc1717251db6479ac810ae80fe8fcf236c8d6ce9
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
USER gradle
WORKDIR /workspace/project
ENTRYPOINT ["sleep", "infinity"]

