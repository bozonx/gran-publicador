-- Add scope consistency constraints for Content Library entities
-- Ensures exactly one of user_id/project_id is set for both tabs and items.

ALTER TABLE "content_library_tabs"
ADD CONSTRAINT "content_library_tabs_scope_chk"
CHECK ( ("user_id" IS NULL) <> ("project_id" IS NULL) );

ALTER TABLE "content_items"
ADD CONSTRAINT "content_items_scope_chk"
CHECK ( ("user_id" IS NULL) <> ("project_id" IS NULL) );
