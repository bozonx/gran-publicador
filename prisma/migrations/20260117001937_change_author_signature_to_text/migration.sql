/*
  Warnings:

  - You are about to drop the column `author_signature_id` on the `posts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "posts_author_signature_id_idx";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "author_signature_id",
ADD COLUMN     "author_signature" TEXT;
