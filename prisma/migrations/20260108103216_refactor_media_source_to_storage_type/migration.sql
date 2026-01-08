/*
  Warnings:

  - You are about to drop the column `src` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `src_type` on the `media` table. All the data in the column will be lost.
  - Added the required column `storage_path` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_type` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "storage_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- Migrate data: copy src_type to storage_type and src to storage_path
-- Convert 'URL' to 'FS' since URL files are downloaded and stored in filesystem
INSERT INTO "new_media" ("id", "type", "storage_type", "storage_path", "filename", "mime_type", "size_bytes", "meta", "created_at", "updated_at")
SELECT 
    "id", 
    "type", 
    CASE 
        WHEN "src_type" = 'URL' THEN 'FS'
        ELSE "src_type"
    END as "storage_type",
    "src" as "storage_path",
    "filename", 
    "mime_type", 
    "size_bytes", 
    "meta", 
    "created_at", 
    "updated_at" 
FROM "media";

DROP TABLE "media";
ALTER TABLE "new_media" RENAME TO "media";
CREATE INDEX "media_type_idx" ON "media"("type");
CREATE INDEX "media_storage_type_idx" ON "media"("storage_type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
