ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE} AS deps
WORKDIR /aicp
COPY package.json package-lock.json ./
COPY apps/console/package.json apps/console/package.json
COPY packages packages
RUN npm ci --ignore-scripts
FROM deps AS builder
COPY . .
RUN npm run build:console
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /aicp/apps/console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /aicp/apps/console/.next/static ./apps/console/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/console/server.js"]
