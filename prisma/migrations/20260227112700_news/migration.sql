/*
  Warnings:

  - You are about to drop the column `news_item_id` on the `publications` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "publications_news_item_id_idx";

-- AlterTable
ALTER TABLE "publications" DROP COLUMN "news_item_id";
