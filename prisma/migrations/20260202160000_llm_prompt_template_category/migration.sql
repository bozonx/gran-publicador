-- CreateEnum
CREATE TYPE "LlmPromptTemplateCategory" AS ENUM ('GENERAL', 'CHAT', 'CONTENT', 'EDITING', 'METADATA');

-- AlterTable
ALTER TABLE "llm_prompt_templates" ADD COLUMN     "category" "LlmPromptTemplateCategory" NOT NULL DEFAULT 'GENERAL';
