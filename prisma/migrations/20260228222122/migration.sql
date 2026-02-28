/*
  Warnings:

  - You are about to drop the column `alt` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "content_item_media" ADD COLUMN     "alt" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "media" DROP COLUMN "alt",
DROP COLUMN "description";

-- AlterTable
ALTER TABLE "publication_media" ADD COLUMN     "alt" TEXT,
ADD COLUMN     "description" TEXT;
