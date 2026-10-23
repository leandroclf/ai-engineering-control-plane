ARG BASE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
FROM ${BASE_IMAGE}

ARG CLI_PACKAGE
ARG CLI_VERSION
RUN test -n "${CLI_PACKAGE}" && test -n "${CLI_VERSION}" \
    && npm install --global "${CLI_PACKAGE}@${CLI_VERSION}" \
    && useradd --create-home --uid 10001 --shell /bin/sh aicp
COPY runtime/entrypoint.sh /usr/local/bin/aicp-runtime-entrypoint
RUN chmod 755 /usr/local/bin/aicp-runtime-entrypoint
ENV HOME=/run/aicp-home AICP_EXTENSION_POLICY=STRICT
USER aicp
WORKDIR /workspace/project
ENTRYPOINT ["/usr/local/bin/aicp-runtime-entrypoint"]
CMD ["sleep", "infinity"]
