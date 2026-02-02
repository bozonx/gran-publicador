-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "publications_project_id_effective_at_idx" ON "publications"("project_id", "effective_at");

-- CreateIndex
CREATE INDEX "publications_effective_at_idx" ON "publications"("effective_at");
