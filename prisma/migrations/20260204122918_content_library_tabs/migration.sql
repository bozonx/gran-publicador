-- CreateEnum
CREATE TYPE "ContentLibraryTabType" AS ENUM ('FOLDER', 'SAVED_VIEW');

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "folder_id" TEXT;

-- CreateTable
CREATE TABLE "content_library_tabs" (
    "id" TEXT NOT NULL,
    "type" "ContentLibraryTabType" NOT NULL,
    "title" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_library_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_library_tabs_user_id_order_idx" ON "content_library_tabs"("user_id", "order");

-- CreateIndex
CREATE INDEX "content_library_tabs_project_id_order_idx" ON "content_library_tabs"("project_id", "order");

-- CreateIndex
CREATE INDEX "content_items_folder_id_created_at_idx" ON "content_items"("folder_id", "created_at");

-- AddForeignKey
ALTER TABLE "content_library_tabs" ADD CONSTRAINT "content_library_tabs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_library_tabs" ADD CONSTRAINT "content_library_tabs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "content_library_tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
