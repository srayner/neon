# Neon Main App Dockerfile
# Multi-stage build for Next.js with standalone output

# ---- Dependencies ----
FROM node:26-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# ---- Builder ----
FROM node:26-alpine AS builder
WORKDIR /app

# Install OpenSSL for Prisma to detect correct version
RUN apk add --no-cache openssl

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.ts ./
COPY postcss.config.mjs ./
# Starts the scheduled alert check when the server starts.
COPY instrumentation.ts ./
COPY app ./app
COPY lib ./lib
COPY public ./public
COPY prisma ./prisma
COPY packages/shared ./packages/shared

# Generate Prisma client
RUN npx prisma generate

# Build shared package first
RUN npm run build:shared

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Prisma CLI ----
# The standalone output has no CLI, and the CLI needs packages the app never
# imports (@prisma/config and its deps), so install it on its own here at the
# exact version locked in package-lock.json. Its own dependencies resolve at
# build time, with the app's npm overrides applied (they replace vulnerable
# versions the CLI pins). `prisma version` fetches the schema engine
# `migrate deploy` uses.
FROM node:26-alpine AS prisma-cli
WORKDIR /prisma-cli
RUN apk add --no-cache openssl
COPY package.json ./app-package.json
COPY package-lock.json ./lock.json
RUN PRISMA_VERSION=$(node -p "require('./lock.json').packages['node_modules/prisma'].version") && \
    node -e "require('fs').writeFileSync('package.json', JSON.stringify({ private: true, overrides: require('./app-package.json').overrides }))" && \
    npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}" && \
    node node_modules/prisma/build/index.js version

# ---- Production ----
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL and glibc compatibility for Prisma
RUN apk upgrade --no-cache && apk add --no-cache openssl libc6-compat

# Nothing at runtime needs npm: the app starts via node and migrations run from
# the locked prisma CLI copied below. Removing it drops npm's bundled deps
# (and their CVEs) from the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Create non-root user, and give it /app itself
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown nextjs:nodejs /app

# Copy built application. Ownership is set as files are copied: a separate
# `chown -R` step would store every file in the image a second time.
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
# The prisma CLI and its dependencies, so the deploy runs `migrate deploy` with
# node node_modules/prisma/build/index.js. Copied first so the generated client
# below is the one the app uses.
COPY --chown=nextjs:nodejs --from=prisma-cli /prisma-cli/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]