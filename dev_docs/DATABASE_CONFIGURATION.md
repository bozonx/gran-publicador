# Database Configuration

## Required Environment Variables

### `DATABASE_URL` (REQUIRED)

The `DATABASE_URL` environment variable is **mandatory** for the application to run. It specifies the connection string for the database.

Example:
```bash
DATABASE_URL="file:./db/gran-publicador.db"
```

### `MEDIA_DIR` and `THUMBNAILS_DIR` (REQUIRED)

Separately, you must configure where media and thumbnails are stored.

```bash
MEDIA_DIR="./data/media"
THUMBNAILS_DIR="./data/thumbnails"
```

**The application will fail to start if these variables are not set.**

## Configuration Files

### Development (`.env.development`)

```bash
DATABASE_URL="file:./test-data/db/db.db"
MEDIA_DIR="./test-data/media"
THUMBNAILS_DIR="./test-data/thumbnails"
```

### Production (Docker)

```bash
DATABASE_URL="file:/data/db/db.db"
MEDIA_DIR="/data/media"
THUMBNAILS_DIR="/data/thumbnails"
```

These are set in the `Dockerfile` and `docker-compose.yml`.

## Error Handling

### Missing Variables

If any of these required variables are not set, the application will fail immediately with a fatal error explaining which variable is missing.

### Directory Creation

- **Database Directory**: The application (Prisma Service) will verify if the directory for the database file exists. If it does not, it will attempt to create it automatically (recursively).
- **Media Directories**: The application relies on `MEDIA_DIR` and `THUMBNAILS_DIR` existing or being writable.

## Migration to Standard Prisma

We have moved away from the custom `DATA_DIR` abstraction back to standard Prisma configuration.

### Before
Relying on `DATA_DIR` to construct paths dynamically.

### After
Explicit `DATABASE_URL` configuration, consistent with standard Prisma usage.

## Docker Deployment

The Docker entrypoint (`docker/entrypoint.sh`) checks for `DATABASE_URL` presence as a sanity check.

## Database Migrations

Migrations are applied automatically on startup using `npx prisma migrate deploy`.

```bash
# In docker/entrypoint.sh
npx prisma migrate deploy
```
