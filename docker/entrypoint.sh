#!/bin/sh
set -e

# Ensure DATA_DIR is set
if [ -z "$DATA_DIR" ]; then
    echo "❌ ERROR: DATA_DIR environment variable is not set!"
    exit 1
fi

echo "📊 Data directory: $DATA_DIR"

# Ensure data directory exists
mkdir -p "${DATA_DIR}"

# Run database migrations
# DATABASE_URL is automatically constructed from DATA_DIR by prisma.config.ts
echo "🔄 Running database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Migrations applied successfully"
else
    echo "❌ Migration failed! Check the logs above."
    exit 1
fi

# Start the application
echo "🚀 Starting application..."
exec "$@"
