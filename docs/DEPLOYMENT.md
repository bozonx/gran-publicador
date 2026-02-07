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

### Autoscaling and migrations

For autoscaling environments, keep `RUN_MIGRATIONS_ON_START=false` and run:

- `prisma migrate deploy`

as a separate one-off task/job (single runner) before rolling out a new version.

### Health check

- `GET /health`

## Frontend (separate deployment)

The frontend is deployed separately from backend.

Configure the frontend to use backend API base URL via:

- `NUXT_PUBLIC_API_BASE=https://api.your-domain.com`
