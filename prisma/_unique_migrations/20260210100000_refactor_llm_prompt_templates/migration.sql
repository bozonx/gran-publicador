-- Step 1: Convert category column from enum to text
-- Add temporary text column, copy data, drop old column, rename
ALTER TABLE "llm_prompt_templates" ADD COLUMN "category_new" TEXT NOT NULL DEFAULT 'General';

UPDATE "llm_prompt_templates" SET "category_new" = CASE
  WHEN "category" = 'GENERAL' THEN 'General'
  WHEN "category" = 'CHAT' THEN 'Chat'
  WHEN "category" = 'CONTENT' THEN 'Content'
  WHEN "category" = 'EDITING' THEN 'Editing'
  WHEN "category" = 'METADATA' THEN 'Metadata'
  ELSE 'General'
END;

ALTER TABLE "llm_prompt_templates" DROP COLUMN "category";
ALTER TABLE "llm_prompt_templates" RENAME COLUMN "category_new" TO "category";

-- Step 2: Add isHidden column to llm_prompt_templates
ALTER TABLE "llm_prompt_templates" ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Drop the old override table
DROP TABLE IF EXISTS "llm_system_prompt_overrides";

-- Step 4: Create new hidden-state table for system templates
CREATE TABLE "llm_system_prompt_hidden" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "system_template_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_system_prompt_hidden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_system_prompt_hidden_user_id_idx" ON "llm_system_prompt_hidden"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_system_prompt_hidden_user_id_system_template_id_key" ON "llm_system_prompt_hidden"("user_id", "system_template_id");

-- AddForeignKey
ALTER TABLE "llm_system_prompt_hidden" ADD CONSTRAINT "llm_system_prompt_hidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop unused enums
DROP TYPE IF EXISTS "LlmSystemPromptOverrideAction";
DROP TYPE IF EXISTS "LlmPromptTemplateCategory";
