-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publication_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "social_media" TEXT NOT NULL,
    "tags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "meta" JSONB NOT NULL,
    "content" TEXT,
    "scheduled_at" DATETIME,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" DATETIME,
    CONSTRAINT "posts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_posts" ("channel_id", "content", "created_at", "error_message", "id", "meta", "publication_id", "published_at", "scheduled_at", "social_media", "status", "tags", "updated_at") SELECT "channel_id", "content", "created_at", "error_message", "id", "meta", "publication_id", "published_at", "scheduled_at", "social_media", "status", "tags", "updated_at" FROM "posts";
DROP TABLE "posts";
ALTER TABLE "new_posts" RENAME TO "posts";
CREATE INDEX "posts_status_scheduled_at_idx" ON "posts"("status", "scheduled_at");
CREATE INDEX "posts_channel_id_created_at_idx" ON "posts"("channel_id", "created_at");
CREATE INDEX "posts_publication_id_idx" ON "posts"("publication_id");
CREATE TABLE "new_publication_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publication_id" TEXT NOT NULL,
    "media_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_media_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publication_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_publication_media" ("created_at", "id", "media_id", "order", "publication_id") SELECT "created_at", "id", "media_id", "order", "publication_id" FROM "publication_media";
DROP TABLE "publication_media";
ALTER TABLE "new_publication_media" RENAME TO "publication_media";
CREATE INDEX "publication_media_publication_id_idx" ON "publication_media"("publication_id");
CREATE INDEX "publication_media_media_id_idx" ON "publication_media"("media_id");
CREATE TABLE "new_publications" (
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
INSERT INTO "new_publications" ("archived_at", "archived_by", "author_comment", "content", "created_at", "created_by", "description", "id", "language", "meta", "note", "post_date", "post_type", "processing_started_at", "project_id", "scheduled_at", "source_texts", "status", "tags", "title", "translation_group_id", "updated_at") SELECT "archived_at", "archived_by", "author_comment", "content", "created_at", "created_by", "description", "id", "language", "meta", "note", "post_date", "post_type", "processing_started_at", "project_id", "scheduled_at", "source_texts", "status", "tags", "title", "translation_group_id", "updated_at" FROM "publications";
DROP TABLE "publications";
ALTER TABLE "new_publications" RENAME TO "publications";
CREATE INDEX "publications_translation_group_id_idx" ON "publications"("translation_group_id");
CREATE INDEX "publications_project_id_status_idx" ON "publications"("project_id", "status");
CREATE INDEX "publications_project_id_created_at_idx" ON "publications"("project_id", "created_at");
CREATE INDEX "publications_project_id_scheduled_at_idx" ON "publications"("project_id", "scheduled_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
