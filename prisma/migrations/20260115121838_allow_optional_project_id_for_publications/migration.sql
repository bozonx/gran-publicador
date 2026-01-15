-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_publications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
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
CREATE INDEX "publications_created_by_project_id_idx" ON "publications"("created_by", "project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
