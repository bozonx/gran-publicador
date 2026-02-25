-- Rename legacy `description` column to `note` in tables where Prisma field `note` was mapped to `description`.
-- This removes the @map("description") legacy from: projects, roles, llm_prompt_templates, channels.

ALTER TABLE "projects" RENAME COLUMN "description" TO "note";
ALTER TABLE "roles" RENAME COLUMN "description" TO "note";
ALTER TABLE "llm_prompt_templates" RENAME COLUMN "description" TO "note";
ALTER TABLE "channels" RENAME COLUMN "description" TO "note";

-- Remove redundant @map("language") from User.language — no DB change needed (column name was already "language").
