/*
  Warnings:

  - You are about to drop the `media_group_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `media_groups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `media_group_id` on the `publication_media` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "media_group_items_media_group_id_media_id_key";

-- DropIndex
DROP INDEX "media_group_items_media_id_idx";

-- DropIndex
DROP INDEX "media_group_items_media_group_id_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "media_group_items";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "media_groups";
PRAGMA foreign_keys=on;

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
    "scheduled_at" DATETIME,
    "published_at" DATETIME,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_posts" ("channel_id", "created_at", "error_message", "id", "publication_id", "published_at", "scheduled_at", "social_media", "status", "tags", "updated_at") SELECT "channel_id", "created_at", "error_message", "id", "publication_id", "published_at", "scheduled_at", "social_media", "status", "tags", "updated_at" FROM "posts";
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
    CONSTRAINT "publication_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_publication_media" ("created_at", "id", "media_id", "order", "publication_id") SELECT "created_at", "id", "media_id", "order", "publication_id" FROM "publication_media";
DROP TABLE "publication_media";
ALTER TABLE "new_publication_media" RENAME TO "publication_media";
CREATE INDEX "publication_media_publication_id_idx" ON "publication_media"("publication_id");
CREATE INDEX "publication_media_media_id_idx" ON "publication_media"("media_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
