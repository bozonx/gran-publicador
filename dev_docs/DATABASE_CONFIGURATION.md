# Database Configuration

## Required Environment Variable

### `DATA_DIR` (REQUIRED)

The `DATA_DIR` environment variable is **mandatory** for the application to run. It specifies the directory where the SQLite database file will be stored.

**The application will fail to start if `DATA_DIR` is not set.**

## How it Works

The database URL is automatically constructed from `DATA_DIR`:

```
DATA_DIR=/data → file:/absolute/path/to/data/gran-publicador.db
DATA_DIR=./test-data → file:/absolute/path/to/test-data/gran-publicador.db
```

The database filename is hardcoded as `gran-publicador.db` and cannot be changed.

## Configuration Files

### Development (`.env.development`)

```bash
DATA_DIR="./test-data"
```

### Production (Docker)

```bash
DATA_DIR=/data
```

This is already set in the `Dockerfile` as an environment variable.

## Error Handling

### Missing `DATA_DIR`

If `DATA_DIR` is not set, the application will fail immediately with:

```
❌ FATAL ERROR: DATA_DIR environment variable is not set!
   DATA_DIR must point to the directory where the database file will be stored.
   Example: DATA_DIR=/data or DATA_DIR=./test-data
```

### Invalid `DATA_DIR`

If `DATA_DIR` points to a non-existent directory:
- In **Docker**: The entrypoint script will create the directory automatically
- In **development**: You need to create the directory manually or it will be created on first database access

## Migration to Prisma 7

With Prisma 7, the database configuration has been simplified:

### Before (Prisma 6)
```bash
DATABASE_URL="file:./data/gran-publicador.db"
```

### After (Prisma 7)
```bash
DATA_DIR="./data"
# DATABASE_URL is constructed automatically
```

## Technical Details

The database URL construction is handled by:

1. **`src/config/database.config.ts`** - `getDatabaseUrl()` function
2. **`prisma.config.ts`** - Prisma 7 configuration
3. **`src/modules/prisma/prisma.service.ts`** - Runtime database connection
4. **`src/main.ts`** - Early validation before app starts

All these components use the same `getDatabaseUrl()` function to ensure consistency.

## Docker Deployment

The Docker entrypoint (`docker/entrypoint.sh`) validates `DATA_DIR` and creates the directory if needed:

```bash
if [ -z "$DATA_DIR" ]; then
    echo "❌ ERROR: DATA_DIR environment variable is not set!"
    exit 1
fi

mkdir -p "${DATA_DIR}"
```

## Database Migrations

Migrations are applied automatically on startup using `prisma migrate deploy`. The database URL is constructed from `DATA_DIR` automatically.

```bash
# In docker/entrypoint.sh
npx prisma migrate deploy
```

No need to set `DATABASE_URL` manually - it's all handled by `DATA_DIR`.
