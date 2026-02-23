-- Ensure UUID generator exists for backfill inserts
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE "TagDomain" AS ENUM ('CONTENT_LIBRARY', 'PUBLICATIONS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add domain column
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "domain" "TagDomain" NOT NULL DEFAULT 'PUBLICATIONS';

-- Rebuild unique indexes to include domain
DROP INDEX IF EXISTS "tags_project_id_normalized_name_key";
DROP INDEX IF EXISTS "tags_user_id_normalized_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "tags_project_id_domain_normalized_name_key" ON "tags"("project_id", "domain", "normalized_name");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_user_id_domain_normalized_name_key" ON "tags"("user_id", "domain", "normalized_name");

-- Split mixed-domain tags: if a tag is used by BOTH content items and publications/posts,
-- create a duplicated tag row for CONTENT_LIBRARY and rewire content-item relations.
CREATE TEMP TABLE IF NOT EXISTS "_tag_domain_split" (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

WITH tags_with_content AS (
  SELECT DISTINCT "B" AS tag_id FROM "_ContentItemToTag"
),
 tags_with_publications AS (
  SELECT DISTINCT "B" AS tag_id FROM "_PublicationToTag"
  UNION
  SELECT DISTINCT "B" AS tag_id FROM "_PostToTag"
),
 tags_both AS (
  SELECT c.tag_id
  FROM tags_with_content c
  INNER JOIN tags_with_publications p ON p.tag_id = c.tag_id
),
 inserted AS (
  INSERT INTO "tags" ("id", "name", "normalized_name", "project_id", "user_id", "domain", "created_at", "updated_at")
  SELECT
    gen_random_uuid()::text,
    t."name",
    t."normalized_name",
    t."project_id",
    t."user_id",
    'CONTENT_LIBRARY'::"TagDomain",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "tags" t
  INNER JOIN tags_both b ON b.tag_id = t."id"
  RETURNING "id" AS new_id, "normalized_name", "project_id", "user_id"
)
INSERT INTO "_tag_domain_split" (old_id, new_id)
SELECT t."id" AS old_id, i.new_id
FROM "tags" t
INNER JOIN tags_both b ON b.tag_id = t."id"
INNER JOIN inserted i
  ON i."normalized_name" = t."normalized_name"
 AND ((i."project_id" IS NOT NULL AND t."project_id" = i."project_id") OR (i."project_id" IS NULL AND t."project_id" IS NULL))
 AND ((i."user_id" IS NOT NULL AND t."user_id" = i."user_id") OR (i."user_id" IS NULL AND t."user_id" IS NULL));

UPDATE "_ContentItemToTag" cit
SET "B" = s.new_id
FROM "_tag_domain_split" s
WHERE cit."B" = s.old_id;

-- Mark tags used ONLY by content items as CONTENT_LIBRARY
WITH tags_with_content AS (
  SELECT DISTINCT "B" AS tag_id FROM "_ContentItemToTag"
),
 tags_with_publications AS (
  SELECT DISTINCT "B" AS tag_id FROM "_PublicationToTag"
  UNION
  SELECT DISTINCT "B" AS tag_id FROM "_PostToTag"
),
 content_only AS (
  SELECT c.tag_id
  FROM tags_with_content c
  LEFT JOIN tags_with_publications p ON p.tag_id = c.tag_id
  WHERE p.tag_id IS NULL
)
UPDATE "tags" t
SET "domain" = 'CONTENT_LIBRARY'
FROM content_only co
WHERE t."id" = co.tag_id;

-- Ensure remaining tags default to PUBLICATIONS
UPDATE "tags" SET "domain" = 'PUBLICATIONS' WHERE "domain" IS NULL;

DROP TABLE IF EXISTS "_tag_domain_split";
