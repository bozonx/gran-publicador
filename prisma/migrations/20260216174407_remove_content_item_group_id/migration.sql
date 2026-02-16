/*
  Warnings:

  - You are about to drop the column `group_id` on the `content_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_items" DROP CONSTRAINT "content_items_group_id_fkey";

-- DropIndex
DROP INDEX "content_items_group_id_created_at_idx";

-- AlterTable
ALTER TABLE "content_items" DROP COLUMN "group_id";
