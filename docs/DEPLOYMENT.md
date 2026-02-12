# Deployment (Production)

This document describes production deployment for Gran Publicador backend and frontend.

## Backend (Render.com via GHCR image)

### Recommended approach

- Build and publish Docker image to GHCR using GitHub Actions.
- Configure Render Web Service to pull the image from GHCR.
- Run database migrations as a separate one-off job.

### Required environment variables

- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET` (min 32 chars)
- `SOCIAL_POSTING_SERVICE_URL`

Optional:

- `PORT` (Render provides it automatically)
- `LISTEN_HOST` / `LISTEN_PORT` (Docker/local usage)
- `RUN_MIGRATIONS_ON_START` (default: `false`)

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
