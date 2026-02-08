-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "post_type" "PostType",
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "template" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_templates_project_id_idx" ON "project_templates"("project_id");

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove footerId from posts
ALTER TABLE "posts" DROP COLUMN IF EXISTS "footer_id";
