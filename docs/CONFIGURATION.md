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

- Redis is required in all non-test environments.
- `REDIS_ENABLED` (must not be `false` in non-test environments)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `REDIS_TTL_MS` (optional, default: `3600000`)
- `REDIS_KEY_PREFIX` (optional)

## External services

- `SOCIAL_POSTING_SERVICE_URL` (required)
- `NEWS_SERVICE_URL` (required for news search/notifications)
- `NEWS_SERVICE_API_TOKEN` (optional)
- `NEWS_SCHEDULER_LOOKBACK_HOURS` (optional, default: `3`)
- `NEWS_SCHEDULER_FETCH_LIMIT` (optional, default: `100`)
- `MEDIA_STORAGE_SERVICE_URL` (optional, but required for media upload endpoints)
- `MEDIA_IMAGE_OPTIMIZATION_ENABLED` (optional, default: `true`)
- `MEDIA_IMAGE_OPTIMIZATION_FORMAT` (optional, default: `webp`, allowed: `webp|avif`)
- `MEDIA_IMAGE_OPTIMIZATION_MAX_DIMENSION` (optional, default: `3840`)
- `MEDIA_IMAGE_OPTIMIZATION_EFFORT` (optional, default: `4`, range: `0..9`)
- `MEDIA_IMAGE_OPTIMIZATION_QUALITY` (optional, default: `80`, range: `1..100`)
- `MEDIA_IMAGE_OPTIMIZATION_CHROMA_SUBSAMPLING` (optional, default: `4:2:0`, allowed: `4:2:0|4:4:4`)
- `MEDIA_IMAGE_OPTIMIZATION_LOSSLESS` (optional, default: `false`)
- `STT_SERVICE_URL` (optional, required for STT/voice transcription features)
- `STT_SERVICE_API_TOKEN` (optional)
- `STT_TIMEOUT_MS` (optional)
- `STT_MAX_FILE_SIZE` (optional)
- `STT_DEFAULT_PROVIDER` (optional, default: `assemblyai`)
- `STT_DEFAULT_MODELS` (optional, comma-separated, default: `universal-2`)
- `STT_SEND_USER_LANGUAGE` (optional, default: `true`)
- `STT_RESTORE_PUNCTUATION` (optional)
- `STT_FORMAT_TEXT` (optional)

## Maintenance schedulers

- News notifications are run manually via system endpoint: `POST /system/schedulers/news/run`
- There is no standalone interval env variable for news notifications.

## UI / LLM

- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_DEFAULT` (optional, default: `10000`) - max context size (characters) for non-article publications in UI prompt builder
- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_ARTICLE` (optional, default: `100000`) - max context size (characters) for article publications in UI prompt builder
