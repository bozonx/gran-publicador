-- AlterTable
-- Convert tags from TEXT to TEXT[] with trimming and default empty array
ALTER TABLE "content_items"
ALTER COLUMN "tags" TYPE TEXT[]
USING (
  COALESCE(
    NULLIF(regexp_split_to_array("tags", '\\s*,\\s*'), ARRAY['']::TEXT[]),
    ARRAY[]::TEXT[]
  )
);

ALTER TABLE "content_items"
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

UPDATE "content_items"
SET "tags" = ARRAY(SELECT lower(trim(x)) FROM unnest("tags") AS x WHERE trim(x) <> '');

ALTER TABLE "content_items"
ALTER COLUMN "tags" SET NOT NULL;
