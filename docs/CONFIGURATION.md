# Configuration

This document lists key production configuration options.

## Networking

- `PORT` (preferred on Render; takes precedence)
- `LISTEN_HOST` (default: `0.0.0.0`)
- `LISTEN_PORT` (default: `8080`)
- `SERVER_BASE_PATH` (optional)

## Database

- `DATABASE_URL` (required)

## Auth

- `JWT_SECRET` (required, min 32 chars)

## Migrations

- `RUN_MIGRATIONS_ON_START` (default: `false`)

## Redis

- `REDIS_ENABLED` (default: `true`)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`

## External services

- `SOCIAL_POSTING_SERVICE_URL` (required)
- `MEDIA_STORAGE_SERVICE_URL` (optional, but required for media upload endpoints)

## UI / LLM

- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_DEFAULT` (optional, default: `10000`) - max context size (characters) for non-article publications in UI prompt builder
- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_ARTICLE` (optional, default: `100000`) - max context size (characters) for article publications in UI prompt builder
