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
- `MEDIA_IMAGE_OPTIMIZATION_ENABLED` (optional, default: `true`)
- `MEDIA_IMAGE_OPTIMIZATION_FORMAT` (optional, default: `webp`, allowed: `webp|avif`)
- `MEDIA_IMAGE_OPTIMIZATION_MAX_DIMENSION` (optional, default: `3840`)
- `MEDIA_IMAGE_OPTIMIZATION_EFFORT` (optional, default: `4`, range: `0..9`)
- `STT_SERVICE_URL` (optional, required for STT/voice transcription features)
- `STT_SERVICE_API_TOKEN` (optional)
- `STT_TIMEOUT_MS` (optional)
- `STT_MAX_FILE_SIZE` (optional)
- `STT_DEFAULT_PROVIDER` (optional, default: `assemblyai`)
- `STT_DEFAULT_MODELS` (optional, comma-separated, default: `universal-2`)
- `STT_SEND_USER_LANGUAGE` (optional, default: `true`)
- `STT_RESTORE_PUNCTUATION` (optional)
- `STT_FORMAT_TEXT` (optional)

## UI / LLM

- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_DEFAULT` (optional, default: `10000`) - max context size (characters) for non-article publications in UI prompt builder
- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_ARTICLE` (optional, default: `100000`) - max context size (characters) for article publications in UI prompt builder
