# Neon Main App Dockerfile
# Multi-stage build for Next.js with standalone output

# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# ---- Builder ----
FROM node:20-alpine AS builder
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

# ---- Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL and glibc compatibility for Prisma
RUN apk add --no-cache openssl libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]