ARG NODE_IMAGE=node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
ARG CHROMIUM_DEB_VERSION=151.0.7922.137-1~deb12u1
FROM ${NODE_IMAGE}
ARG CHROMIUM_DEB_VERSION

RUN apt-get update \
    && apt-get install -y --no-install-recommends "chromium=${CHROMIUM_DEB_VERSION}" "chromium-common=${CHROMIUM_DEB_VERSION}" ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node /var/lib/aicp/browser-profiles

WORKDIR /aicp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY harness ./harness

USER node
ENV BROWSER_EXECUTABLE=chromium
ENV BROWSER_PROFILE_ROOT=/var/lib/aicp/browser-profiles
ENTRYPOINT ["node", "harness/src/capabilities/browser-worker-server.mjs"]
