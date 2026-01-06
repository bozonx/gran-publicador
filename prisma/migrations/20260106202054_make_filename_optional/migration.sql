-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "src_type" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_media" ("created_at", "filename", "id", "meta", "mime_type", "size_bytes", "src", "src_type", "type", "updated_at") SELECT "created_at", "filename", "id", "meta", "mime_type", "size_bytes", "src", "src_type", "type", "updated_at" FROM "media";
DROP TABLE "media";
ALTER TABLE "new_media" RENAME TO "media";
CREATE INDEX "media_type_idx" ON "media"("type");
CREATE INDEX "media_src_type_idx" ON "media"("src_type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
