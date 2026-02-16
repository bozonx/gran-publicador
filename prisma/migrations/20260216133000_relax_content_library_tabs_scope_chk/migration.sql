-- Relax tabs scope constraint to support project personal tabs/groups
-- Old rule required exactly one of user_id/project_id to be set.
-- New rule: at least one of user_id/project_id must be set (allows both).

ALTER TABLE "content_library_tabs" DROP CONSTRAINT IF EXISTS "content_library_tabs_scope_chk";

ALTER TABLE "content_library_tabs"
ADD CONSTRAINT "content_library_tabs_scope_chk"
CHECK ( ("user_id" IS NOT NULL) OR ("project_id" IS NOT NULL) );
