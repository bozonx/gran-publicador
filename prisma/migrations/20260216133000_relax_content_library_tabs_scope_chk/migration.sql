-- Relax collections scope constraint to support project personal collections/groups
-- Old rule required exactly one of user_id/project_id to be set.
-- New rule: at least one of user_id/project_id must be set (allows both).

-- Align physical table/column names with Prisma mapping.
ALTER TABLE IF EXISTS "content_library_tabs" RENAME TO "content_collections";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_item_groups'
      AND column_name = 'tab_id'
  ) THEN
    ALTER TABLE "content_item_groups" RENAME COLUMN "tab_id" TO "collection_id";
  END IF;
END $$;

ALTER TABLE "content_collections" DROP CONSTRAINT IF EXISTS "content_library_tabs_scope_chk";
ALTER TABLE "content_collections" DROP CONSTRAINT IF EXISTS "content_collections_scope_chk";

ALTER TABLE "content_collections"
ADD CONSTRAINT "content_collections_scope_chk"
CHECK ( ("user_id" IS NOT NULL) OR ("project_id" IS NOT NULL) );
