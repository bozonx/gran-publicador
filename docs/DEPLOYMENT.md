# Deployment (Production)

This document describes production deployment for Gran Publicador backend and frontend.

## Backend (Render.com via GHCR image)

### Recommended approach

- Build and publish Docker image to GHCR using GitHub Actions.
- Configure Render Web Service to pull the image from GHCR.
- Run database migrations as a separate one-off job.

### Architecture Overview

For production, the backend consists of two separate processes that use the same Docker image:
1. **API Service** - Runs the main HTTP/WebSocket server (`node dist/src/main.js`).
2. **Background Worker** - Processes async queues like publications (`node dist/src/worker.js`).

Both need access to the same Database and Redis instance.

### Required environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — min 32 chars (also used as AES-256 key)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather
- `SOCIAL_POSTING_SERVICE_URL` — social media posting microservice URL
- `MEDIA_STORAGE_SERVICE_URL` — media storage microservice URL
- `FREE_LLM_ROUTER_URL` — LLM router microservice URL

Optional but recommended:

- `REDIS_URL` — Redis connection URL (e.g. `redis://localhost:6379/0`). Works with Upstash.
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` — Fallback Redis connection if `REDIS_URL` is not set.
- `STT_SERVICE_URL` — Speech-To-Text gateway URL
- `TRANSLATE_SERVICE_URL` — Translation gateway URL
- `NEWS_SERVICE_URL` — News service URL
- `SYSTEM_API_SECRET` — shared secret for system API endpoints (e.g. n8n triggers)
- `SYSTEM_API_IP_RESTRICTION_ENABLED` — restrict system API to local network IPs (default: `true`)
- `TELEGRAM_BOT_ENABLED` — enable Telegram bot for content collection (default: `false`)
- `TELEGRAM_BOT_USE_WEBHOOK` — use Webhooks instead of Long Polling (default: `false`)
- `TELEGRAM_BOT_WEB_URL` — Base URL for Telegram Bot Webhook
- `TELEGRAM_ADMIN_ID` — Telegram ID of the super-administrator
- `FRONTEND_URL` — frontend URL for links in bot messages
- `TELEGRAM_MINI_APP_URL` — Telegram Mini App base URL
- `PORT` — Render provides it automatically
- `LISTEN_HOST` / `LISTEN_PORT` — Docker/local usage
- `RUN_MIGRATIONS_ON_START` — default: `false`
- `LOG_LEVEL` — `trace`, `debug`, `info`, `warn`, `error`, `fatal` (default: `warn`)
- `SCHEDULER_WINDOW_MINUTES` — past window for scheduled tasks (default: `10`)
- `SHUTDOWN_TIMEOUT_SECONDS` — graceful shutdown timeout (default: `30`)
- `TZ` — application timezone (default: `UTC`)
- `UNSPLASH_ACCESS_KEY` — Unsplash API key for image collection
- `MEDIA_IMAGE_OPTIMIZATION_ENABLED` — Enable automatic image optimization (default: `true`)
- `HTTP_RETRY_MAX_ATTEMPTS` — Outbound HTTP request retry limit (default: `3`)

See `.env.production.example` for the full list with defaults.

### Database Migrations on Render.com

**⚠️ Important:** Never run migrations in the Start Command when using multiple instances or autoscaling.

#### Option 1: Render Job (Recommended)

Create a separate Job in Render Dashboard:

1. Navigate to your project → "New" → "Job"
2. Configure:
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm prisma generate`
   - **Start Command:** `pnpm db:migrate:deploy`
   - **Environment Variables:** Add `DATABASE_URL` (same as your web service)
3. Run manually before each deployment or configure auto-trigger

#### Option 2: Render Blueprint (Infrastructure as Code)

Use the included `render.yaml` file:

```yaml
# See render.yaml in project root
```

This automatically creates:
- Web service for backend
- Separate job for migrations
- Database configuration

Deploy via Render Dashboard → "New" → "Blueprint" → Connect to your repository.

#### Option 3: Manual Shell Execution

For one-time migrations:

1. Go to your service in Render Dashboard
2. Click "Shell" tab
3. Run:
   ```bash
   pnpm db:migrate:deploy
   ```

#### Migration Workflow

1. **Before deployment:**
   - Run migration job (Option 1 or 2)
   - Verify migration success in logs

2. **Deploy new version:**
   - Render will automatically pull latest image from GHCR
   - Application starts with updated schema

3. **Rollback (if needed):**
   - Revert to previous image version
   - Run appropriate migration rollback if necessary

### Autoscaling and migrations

For autoscaling environments, keep `RUN_MIGRATIONS_ON_START=false` and always use a separate one-off job (single runner) for migrations.

### Health check

- `GET /health`

## Frontend (separate deployment)

The frontend is deployed separately from backend.

Configure the frontend to use backend API base URL via:

- `NUXT_PUBLIC_API_BASE=https://api.your-domain.com`
