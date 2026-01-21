/*
  Warnings:

  - You are about to drop the column `scope_project_ids` on the `api_tokens` table. All the data in the column will be lost.

*/

-- Step 1: Add new column with default value
ALTER TABLE "api_tokens" ADD COLUMN "all_projects" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate data from scope_project_ids to api_token_projects table
-- For tokens with empty array [] - set all_projects = true
UPDATE "api_tokens"
SET "all_projects" = true
WHERE jsonb_array_length("scope_project_ids"::jsonb) = 0;

-- Step 3: Create api_token_projects table
CREATE TABLE "api_token_projects" (
    "id" TEXT NOT NULL,
    "api_token_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_projects_pkey" PRIMARY KEY ("id")
);

-- Step 4: Migrate project IDs from JSON array to relation table
-- For each token with non-empty scope_project_ids, create records in api_token_projects
INSERT INTO "api_token_projects" ("id", "api_token_id", "project_id", "created_at")
SELECT 
    gen_random_uuid()::text,
    t.id,
    jsonb_array_elements_text(t.scope_project_ids::jsonb)::text,
    NOW()
FROM "api_tokens" t
WHERE jsonb_array_length(t.scope_project_ids::jsonb) > 0;

-- Step 5: Drop old column
ALTER TABLE "api_tokens" DROP COLUMN "scope_project_ids";

-- CreateIndex
CREATE INDEX "api_token_projects_api_token_id_idx" ON "api_token_projects"("api_token_id");

-- CreateIndex
CREATE INDEX "api_token_projects_project_id_idx" ON "api_token_projects"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_token_projects_api_token_id_project_id_key" ON "api_token_projects"("api_token_id", "project_id");

-- AddForeignKey
ALTER TABLE "api_token_projects" ADD CONSTRAINT "api_token_projects_api_token_id_fkey" FOREIGN KEY ("api_token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token_projects" ADD CONSTRAINT "api_token_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
