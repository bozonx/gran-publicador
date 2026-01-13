-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT,
    "telegram_username" TEXT,
    "avatar_url" TEXT,
    "telegram_id" BIGINT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "preferences" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "scope_project_ids" JSONB NOT NULL,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "archived_at" DATETIME,
    "archived_by" TEXT,
    "preferences" JSONB NOT NULL,
    CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "social_media" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel_identifier" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "tags" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "archived_at" DATETIME,
    "archived_by" TEXT,
    CONSTRAINT "channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "translation_group_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" DATETIME,
    "archived_by" TEXT,
    "scheduled_at" DATETIME,
    "processing_started_at" DATETIME,
    "post_type" TEXT NOT NULL DEFAULT 'POST',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "content" TEXT,
    "author_comment" TEXT,
    "tags" TEXT,
    "meta" JSONB NOT NULL,
    "post_date" DATETIME,
    "note" TEXT,
    "source_texts" JSONB NOT NULL,
    CONSTRAINT "publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publication_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "social_media" TEXT NOT NULL,
    "tags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "meta" JSONB NOT NULL,
    "template" JSONB,
    "content" TEXT,
    "platform_options" JSONB,
    "scheduled_at" DATETIME,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "storage_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "meta" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "publication_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publication_id" TEXT NOT NULL,
    "media_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_media_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publication_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_telegram_username_idx" ON "users"("telegram_username");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_hashed_token_key" ON "api_tokens"("hashed_token");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "channels_project_id_idx" ON "channels"("project_id");

-- CreateIndex
CREATE INDEX "publications_translation_group_id_idx" ON "publications"("translation_group_id");

-- CreateIndex
CREATE INDEX "publications_project_id_status_idx" ON "publications"("project_id", "status");

-- CreateIndex
CREATE INDEX "publications_project_id_created_at_idx" ON "publications"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "publications_project_id_scheduled_at_idx" ON "publications"("project_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "posts_status_scheduled_at_idx" ON "posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "posts_channel_id_created_at_idx" ON "posts"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_publication_id_idx" ON "posts"("publication_id");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- CreateIndex
CREATE INDEX "media_storage_type_idx" ON "media"("storage_type");

-- CreateIndex
CREATE INDEX "publication_media_publication_id_idx" ON "publication_media"("publication_id");

-- CreateIndex
CREATE INDEX "publication_media_media_id_idx" ON "publication_media"("media_id");
