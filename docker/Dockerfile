ARG NODE_MAJOR=22
FROM node:${NODE_MAJOR}-bookworm-slim

# Install dependencies for Prisma, better-sqlite3 and other tools
# build-essential, python3 are required for building better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  openssl \
  build-essential \
  python3 \
  python-is-python3 \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn
ENV DATA_DIR=/data

# Install pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./
# Also need ui package.json if we want to run anything, but maybe not necessary for runtime
# However, we need dependencies for prisma and the app itself

# Install dependencies (including better-sqlite3 which needs to be built)
# Use --ignore-scripts during install to speed up, then rebuild only better-sqlite3
RUN pnpm install --prod --frozen-lockfile --prefer-offline || pnpm install --prod --prefer-offline

# Explicitly rebuild better-sqlite3 to ensure it's compiled for the container's architecture
RUN pnpm rebuild better-sqlite3

# Copy pre-built backend application
COPY dist ./dist

# Copy pre-built frontend application
COPY ui/.output ./ui/.output

# Copy prisma schema and migrations
COPY prisma ./prisma

# Copy prisma config
COPY prisma.config.ts ./

# Copy generated prisma client source
COPY src/generated ./src/generated

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Generate prisma client inside container to ensure architecture compatibility
# This will also ensure better-sqlite3 is built for the container's architecture
RUN npx prisma generate

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
