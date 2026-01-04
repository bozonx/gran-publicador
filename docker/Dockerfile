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

# Use hoisted node-linker to avoid symlink issues in Docker
RUN pnpm config set node-linker hoisted

# 1. Install dependencies
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
# Copy ui package.json just in case workspace needs it to resolve
COPY ui/package.json ./ui/package.json
RUN pnpm fetch

# Install all dependencies (including dev)
COPY . .
RUN pnpm install --frozen-lockfile --offline

# 2. Build modules that need compilation
# Explicitly rebuild better-sqlite3 for the current architecture
RUN pnpm rebuild better-sqlite3

# 3. Generate Prisma client
RUN npx prisma generate

# 4. Build backend application
RUN pnpm build

# -----------------------------------------------------------------------------
# Runtime Stage
# -----------------------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm-slim

# Install runtime dependencies
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
# Since we used hoisted linker, structure is flat and safe to copy
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Copy UI build (assuming it was built externally or exists in context)
# Note: we are not building UI in Docker to save time/resources,
# assuming CI or user provides ui/.output
COPY ui/.output ./ui/.output

# Copy other necessary files
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/generated ./src/generated
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
