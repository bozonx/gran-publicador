-- CreateEnum
CREATE TYPE "LlmSystemPromptOverrideAction" AS ENUM ('OVERRIDE', 'HIDE');

-- CreateTable
CREATE TABLE "llm_system_prompt_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "system_key" TEXT NOT NULL,
    "action" "LlmSystemPromptOverrideAction" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "prompt" TEXT,
    "category" "LlmPromptTemplateCategory",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_system_prompt_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_system_prompt_overrides_user_id_idx" ON "llm_system_prompt_overrides"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_system_prompt_overrides_user_id_system_key_key" ON "llm_system_prompt_overrides"("user_id", "system_key");

-- AddForeignKey
ALTER TABLE "llm_system_prompt_overrides" ADD CONSTRAINT "llm_system_prompt_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
