#!/bin/sh
set -e

# Ensure DATABASE_URL is available (optional check, prisma will fail otherwise)
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL is not set. Prisma might fail if not configured elsewhere."
fi

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
    # Run database migrations
    # DATABASE_URL should be passed via environment variables
    echo "🔄 Running database migrations..."
    if ./node_modules/.bin/prisma migrate deploy; then
        echo "✅ Migrations applied successfully"
    else
        echo "❌ Migration failed! Check the logs above."
        exit 1
    fi
else
    echo "ℹ️  Skipping database migrations (RUN_MIGRATIONS_ON_START is not true)"
fi

# Start the application
echo "🚀 Starting application..."
exec "$@"
