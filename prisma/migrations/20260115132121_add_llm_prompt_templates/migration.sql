-- CreateTable
CREATE TABLE "llm_prompt_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "llm_prompt_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "llm_prompt_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "llm_prompt_templates_user_id_idx" ON "llm_prompt_templates"("user_id");

-- CreateIndex
CREATE INDEX "llm_prompt_templates_project_id_idx" ON "llm_prompt_templates"("project_id");
