ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a

FROM ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f AS gitleaks
FROM aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969 AS trivy

FROM ${NODE_IMAGE}

ARG OPENCODE_VERSION=1.18.21
ARG DEV_UID=1000
ARG DEV_GID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git jq python3 python3-pip ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "opencode-ai@${OPENCODE_VERSION}" \
    && pip3 install --break-system-packages --no-cache-dir semgrep==1.174.0 \
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

COPY --from=gitleaks /usr/bin/gitleaks /usr/local/bin/gitleaks
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy

WORKDIR /aicp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY context ./context
COPY harness ./harness
COPY security ./security
COPY scripts/scanner-bundle-manifest.mjs ./scripts/scanner-bundle-manifest.mjs
COPY docker/harness/entrypoint.sh /usr/local/bin/aicp-harness-entrypoint
RUN chmod 755 /usr/local/bin/aicp-harness-entrypoint \
    && install -d -o dev -g dev /home/dev/.cache /home/dev/.config/opencode /home/dev/.local/share/opencode /home/dev/.local/state

ENV HOME=/home/dev
USER dev
ENTRYPOINT ["aicp-harness-entrypoint"]
CMD ["node", "harness/src/cli/run-workflow.mjs", "serve"]
