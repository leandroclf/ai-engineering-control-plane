ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE}

ARG OPENCODE_VERSION=1.18.21
ARG DEV_UID=1000
ARG DEV_GID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git jq python3 ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && if getent group "${DEV_GID}" >/dev/null; then \
         existing_group="$(getent group "${DEV_GID}" | cut -d: -f1)"; \
         test "${existing_group}" = dev || groupmod --new-name dev "${existing_group}"; \
       else \
         groupadd --gid "${DEV_GID}" dev; \
       fi \
    && if getent passwd "${DEV_UID}" >/dev/null; then \
         existing_user="$(getent passwd "${DEV_UID}" | cut -d: -f1)"; \
         test "${existing_user}" = dev || usermod --login dev --home /home/dev --move-home "${existing_user}"; \
         usermod --gid "${DEV_GID}" --shell /bin/bash dev; \
       else \
         useradd --create-home --uid "${DEV_UID}" --gid "${DEV_GID}" --shell /bin/bash dev; \
       fi

WORKDIR /aicp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY context ./context
COPY harness ./harness
COPY docker/harness/entrypoint.sh /usr/local/bin/aicp-harness-entrypoint
RUN chmod 755 /usr/local/bin/aicp-harness-entrypoint \
    && install -d -o dev -g dev /home/dev/.cache /home/dev/.config/opencode /home/dev/.local/share/opencode /home/dev/.local/state

ENV HOME=/home/dev
USER dev
ENTRYPOINT ["aicp-harness-entrypoint"]
CMD ["node", "harness/src/cli/run-workflow.mjs", "serve"]
