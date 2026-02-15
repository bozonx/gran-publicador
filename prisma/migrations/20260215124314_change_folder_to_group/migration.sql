/*
  Warnings:

  - The values [FOLDER] on the enum `ContentLibraryTabType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `folder_id` on the `content_items` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContentLibraryTabType_new" AS ENUM ('GROUP', 'SAVED_VIEW');
ALTER TABLE "content_library_tabs" ALTER COLUMN "type" TYPE "ContentLibraryTabType_new" USING ("type"::text::"ContentLibraryTabType_new");
ALTER TYPE "ContentLibraryTabType" RENAME TO "ContentLibraryTabType_old";
ALTER TYPE "ContentLibraryTabType_new" RENAME TO "ContentLibraryTabType";
DROP TYPE "public"."ContentLibraryTabType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "content_items" DROP CONSTRAINT "content_items_folder_id_fkey";

-- DropIndex
DROP INDEX "content_items_folder_id_created_at_idx";

-- AlterTable
ALTER TABLE "content_items" DROP COLUMN "folder_id",
ADD COLUMN     "group_id" TEXT;

-- AlterTable
ALTER TABLE "content_library_tabs" ADD COLUMN     "parent_id" TEXT;

-- CreateTable
CREATE TABLE "content_item_groups" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_item_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_item_groups_content_item_id_idx" ON "content_item_groups"("content_item_id");

-- CreateIndex
CREATE INDEX "content_item_groups_tab_id_idx" ON "content_item_groups"("tab_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_groups_content_item_id_tab_id_key" ON "content_item_groups"("content_item_id", "tab_id");

-- CreateIndex
CREATE INDEX "content_items_group_id_created_at_idx" ON "content_items"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "content_library_tabs_parent_id_order_idx" ON "content_library_tabs"("parent_id", "order");

-- AddForeignKey
ALTER TABLE "content_library_tabs" ADD CONSTRAINT "content_library_tabs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_library_tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "content_library_tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_groups" ADD CONSTRAINT "content_item_groups_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_groups" ADD CONSTRAINT "content_item_groups_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "content_library_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
