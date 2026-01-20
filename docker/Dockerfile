ARG NODE_MAJOR=22

# -----------------------------------------------------------------------------
# Builder Stage (Handles native modules compilation)
# -----------------------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm AS builder

WORKDIR /app
RUN corepack enable

# 1. Install dependencies
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY ui/package.json ./ui/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Copy source code (needed for prisma config and build context)
COPY . .

# 3. Generate Prisma client (required for migrations in entrypoint)
# Prisma generate doesn't typically need a real DB connection, but we set a dummy URL to suppress warnings
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# -----------------------------------------------------------------------------
# Runtime Stage
# -----------------------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl \
  ca-certificates \
  wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn
# Default configuration for Docker - expects linked postgres container
ENV DATABASE_URL="postgresql://gran:gran_password@postgres:5432/gran_db?schema=public"

# Copy pre-compiled dependencies and prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy application code (assumed built on host or in CI)
# This includes backend (dist) and frontend (ui/.output)
COPY dist ./dist
COPY ui/.output ./ui/.output

# Copy remaining necessary files
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/generated ./src/generated
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
