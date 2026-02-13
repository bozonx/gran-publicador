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
-- Note: Avoid expression indexes (COALESCE / casts) to keep migration compatible with Postgres immutability rules.
-- We cover all NULL combinations with partial unique indexes.

-- 1) language IS NOT NULL AND post_type IS NOT NULL
CREATE UNIQUE INDEX "project_templates_one_default_lang_type"
ON "project_templates" ("project_id", "language", "post_type")
WHERE "is_default" = true AND "language" IS NOT NULL AND "post_type" IS NOT NULL;

-- 2) language IS NULL AND post_type IS NOT NULL
CREATE UNIQUE INDEX "project_templates_one_default_any_lang_type"
ON "project_templates" ("project_id", "post_type")
WHERE "is_default" = true AND "language" IS NULL AND "post_type" IS NOT NULL;

-- 3) language IS NOT NULL AND post_type IS NULL
CREATE UNIQUE INDEX "project_templates_one_default_lang_any_type"
ON "project_templates" ("project_id", "language")
WHERE "is_default" = true AND "language" IS NOT NULL AND "post_type" IS NULL;

-- 4) language IS NULL AND post_type IS NULL
CREATE UNIQUE INDEX "project_templates_one_default_any_lang_any_type"
ON "project_templates" ("project_id")
WHERE "is_default" = true AND "language" IS NULL AND "post_type" IS NULL;
