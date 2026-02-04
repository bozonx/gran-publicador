/*
  Warnings:

  - You are about to drop the column `type` on the `content_blocks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "content_blocks_type_idx";

-- AlterTable
ALTER TABLE "content_blocks" DROP COLUMN "type";
