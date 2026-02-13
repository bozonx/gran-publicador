-- Add FK for publications.project_template_id -> project_templates.id
ALTER TABLE "publications"
ADD CONSTRAINT "publications_project_template_id_fkey"
FOREIGN KEY ("project_template_id")
REFERENCES "project_templates"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Index for faster lookups by template
-- Note: Prisma will also create an index based on @@index([projectTemplateId]).
-- Keeping this as IF NOT EXISTS avoids conflicts if the index already exists.
CREATE INDEX IF NOT EXISTS "publications_project_template_id_idx" ON "publications"("project_template_id");

-- Enforce only one default template per (project_id, language, post_type)
-- We use COALESCE to handle NULL language/post_type as a stable grouping key
CREATE UNIQUE INDEX "project_templates_one_default_per_group"
ON "project_templates"(
  "project_id",
  COALESCE("language", ''),
  COALESCE("post_type"::text, '')
)
WHERE "is_default" = true;
