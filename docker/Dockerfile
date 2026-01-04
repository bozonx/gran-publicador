ARG NODE_MAJOR=22

# -----------------------------------------------------------------------------
# Builder Stage
# -----------------------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable

# 1. Install dependencies
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch

# Install all dependencies (including dev)
COPY . .
RUN pnpm install --frozen-lockfile --offline

# 2. Build modules that need compilation
# Explicitly rebuild better-sqlite3 for the current architecture
RUN pnpm rebuild better-sqlite3

# 3. Generate Prisma client
RUN npx prisma generate

# 4. Prune dev dependencies, BUT keep built binaries
# We use a trick: prune to a separate location or just copy what we need
# For simplicity and reliability with native modules, we'll keep node_modules from builder
# in the final image. To optimize size, we could try to prune, but it risks breaking native deps.
# Let's try to prune but verify better-sqlite3 is kept correctly.
# Actually, pruning removes build artifacts often. Safest is to keep node_modules as is 
# or use pnpm deploy which is cleaner but more complex setup.
# Let's stick to: use the installed node_modules.

# -----------------------------------------------------------------------------
# Runtime Stage
# -----------------------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm-slim

# Install runtime dependencies
# openssl is required for Prisma
# python3/build-essential NOT needed for runtime if native modules are pre-built correctly
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn
ENV DATA_DIR=/data

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy application code
COPY dist ./dist
COPY ui/.output ./ui/.output
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/generated ./src/generated
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
