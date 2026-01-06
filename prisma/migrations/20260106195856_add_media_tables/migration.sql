/*
  Warnings:

  - You are about to drop the column `media_files` on the `publications` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "src_type" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "media_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "media_group_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "media_group_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "media_group_items_media_group_id_fkey" FOREIGN KEY ("media_group_id") REFERENCES "media_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "media_group_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "publication_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publication_id" TEXT NOT NULL,
    "media_id" TEXT,
    "media_group_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_media_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publication_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "publication_media_media_group_id_fkey" FOREIGN KEY ("media_group_id") REFERENCES "media_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_publications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "translation_group_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" DATETIME,
    "archived_by" TEXT,
    "title" TEXT,
    "description" TEXT,
    "content" TEXT,
    "author_comment" TEXT,
    "tags" TEXT,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "post_type" TEXT NOT NULL DEFAULT 'POST',
    "post_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "error_message" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru-RU',
    "scheduled_at" DATETIME,
    CONSTRAINT "publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_publications" ("archived_at", "archived_by", "author_comment", "content", "created_at", "created_by", "description", "error_message", "id", "language", "meta", "post_date", "post_type", "project_id", "scheduled_at", "status", "tags", "title", "translation_group_id", "updated_at") SELECT "archived_at", "archived_by", "author_comment", "content", "created_at", "created_by", "description", "error_message", "id", "language", "meta", "post_date", "post_type", "project_id", "scheduled_at", "status", "tags", "title", "translation_group_id", "updated_at" FROM "publications";
DROP TABLE "publications";
ALTER TABLE "new_publications" RENAME TO "publications";
CREATE INDEX "publications_translation_group_id_idx" ON "publications"("translation_group_id");
CREATE INDEX "publications_project_id_status_idx" ON "publications"("project_id", "status");
CREATE INDEX "publications_project_id_created_at_idx" ON "publications"("project_id", "created_at");
CREATE INDEX "publications_project_id_scheduled_at_idx" ON "publications"("project_id", "scheduled_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- CreateIndex
CREATE INDEX "media_src_type_idx" ON "media"("src_type");

-- CreateIndex
CREATE INDEX "media_group_items_media_group_id_idx" ON "media_group_items"("media_group_id");

-- CreateIndex
CREATE INDEX "media_group_items_media_id_idx" ON "media_group_items"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_group_items_media_group_id_media_id_key" ON "media_group_items"("media_group_id", "media_id");

-- CreateIndex
CREATE INDEX "publication_media_publication_id_idx" ON "publication_media"("publication_id");

-- CreateIndex
CREATE INDEX "publication_media_media_id_idx" ON "publication_media"("media_id");

-- CreateIndex
CREATE INDEX "publication_media_media_group_id_idx" ON "publication_media"("media_group_id");
