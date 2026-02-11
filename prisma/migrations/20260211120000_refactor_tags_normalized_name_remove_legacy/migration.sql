-- Ensure UUID generator exists for backfill inserts
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add normalized_name for case-insensitive uniqueness and fast autocomplete
ALTER TABLE "tags" ADD COLUMN "normalized_name" TEXT;

-- Backfill normalized_name
UPDATE "tags" SET "normalized_name" = lower(trim("name")) WHERE "normalized_name" IS NULL;

-- Ensure scope is explicit: exactly one of project_id or user_id must be set
ALTER TABLE "tags"
ADD CONSTRAINT "tags_scope_check"
CHECK (("project_id" IS NOT NULL AND "user_id" IS NULL) OR ("project_id" IS NULL AND "user_id" IS NOT NULL));

-- Rebuild unique indexes to use normalized_name
DROP INDEX IF EXISTS "tags_project_id_name_key";
DROP INDEX IF EXISTS "tags_user_id_name_key";

CREATE UNIQUE INDEX "tags_project_id_normalized_name_key" ON "tags"("project_id", "normalized_name");
CREATE UNIQUE INDEX "tags_user_id_normalized_name_key" ON "tags"("user_id", "normalized_name");

CREATE INDEX IF NOT EXISTS "tags_normalized_name_idx" ON "tags"("normalized_name");

-- Migrate legacy tags from publications.tags (CSV) into tag table + relation
INSERT INTO "tags" ("id", "name", "normalized_name", "project_id", "user_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  x.tag AS name,
  lower(x.tag) AS normalized_name,
  x.project_id,
  NULL::text AS user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    p."project_id" AS project_id,
    trim(t) AS tag
  FROM "publications" p
  CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p."tags", ''), ',')) AS t
  WHERE trim(t) <> ''
) x
ON CONFLICT ("project_id", "normalized_name") DO NOTHING;

INSERT INTO "_PublicationToTag" ("A", "B")
SELECT DISTINCT
  p."id" AS "A",
  tg."id" AS "B"
FROM "publications" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p."tags", ''), ',')) AS t
JOIN "tags" tg
  ON tg."project_id" = p."project_id"
 AND tg."normalized_name" = lower(trim(t))
WHERE trim(t) <> ''
ON CONFLICT DO NOTHING;

-- Migrate legacy tags from posts.tags (CSV) into tag table + relation
INSERT INTO "tags" ("id", "name", "normalized_name", "project_id", "user_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  x.tag AS name,
  lower(x.tag) AS normalized_name,
  x.project_id,
  NULL::text AS user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    pub."project_id" AS project_id,
    trim(t) AS tag
  FROM "posts" po
  JOIN "publications" pub ON pub."id" = po."publication_id"
  CROSS JOIN LATERAL unnest(string_to_array(COALESCE(po."tags", ''), ',')) AS t
  WHERE trim(t) <> ''
) x
ON CONFLICT ("project_id", "normalized_name") DO NOTHING;

INSERT INTO "_PostToTag" ("A", "B")
SELECT DISTINCT
  po."id" AS "A",
  tg."id" AS "B"
FROM "posts" po
JOIN "publications" pub ON pub."id" = po."publication_id"
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(po."tags", ''), ',')) AS t
JOIN "tags" tg
  ON tg."project_id" = pub."project_id"
 AND tg."normalized_name" = lower(trim(t))
WHERE trim(t) <> ''
ON CONFLICT DO NOTHING;

-- Migrate legacy tags from content_items.tags (text[]) into tag table + relation
-- Project scope
INSERT INTO "tags" ("id", "name", "normalized_name", "project_id", "user_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  x.tag AS name,
  lower(x.tag) AS normalized_name,
  x.project_id,
  NULL::text AS user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    ci."project_id" AS project_id,
    trim(t) AS tag
  FROM "content_items" ci
  CROSS JOIN LATERAL unnest(COALESCE(ci."tags", ARRAY[]::text[])) AS t
  WHERE trim(t) <> ''
    AND ci."project_id" IS NOT NULL
    AND ci."user_id" IS NULL
) x
ON CONFLICT ("project_id", "normalized_name") DO NOTHING;

-- Personal scope
INSERT INTO "tags" ("id", "name", "normalized_name", "project_id", "user_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  x.tag AS name,
  lower(x.tag) AS normalized_name,
  NULL::text AS project_id,
  x.user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    ci."user_id" AS user_id,
    trim(t) AS tag
  FROM "content_items" ci
  CROSS JOIN LATERAL unnest(COALESCE(ci."tags", ARRAY[]::text[])) AS t
  WHERE trim(t) <> ''
    AND ci."project_id" IS NULL
    AND ci."user_id" IS NOT NULL
) x
ON CONFLICT ("user_id", "normalized_name") DO NOTHING;

INSERT INTO "_ContentItemToTag" ("A", "B")
SELECT DISTINCT
  ci."id" AS "A",
  tg."id" AS "B"
FROM "content_items" ci
CROSS JOIN LATERAL unnest(COALESCE(ci."tags", ARRAY[]::text[])) AS t
JOIN "tags" tg
  ON (
    (ci."project_id" IS NOT NULL AND tg."project_id" = ci."project_id" AND tg."user_id" IS NULL)
    OR
    (ci."user_id" IS NOT NULL AND tg."user_id" = ci."user_id" AND tg."project_id" IS NULL)
  )
 AND tg."normalized_name" = lower(trim(t))
WHERE trim(t) <> ''
ON CONFLICT DO NOTHING;

-- Drop legacy scalar columns
ALTER TABLE "publications" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "content_items" DROP COLUMN IF EXISTS "tags";
