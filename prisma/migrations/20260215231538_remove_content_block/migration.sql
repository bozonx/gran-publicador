/*
  Warnings:

  - You are about to drop the `content_block_media` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `content_blocks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_block_media" DROP CONSTRAINT "content_block_media_content_block_id_fkey";

-- DropForeignKey
ALTER TABLE "content_block_media" DROP CONSTRAINT "content_block_media_media_id_fkey";

-- DropForeignKey
ALTER TABLE "content_blocks" DROP CONSTRAINT "content_blocks_content_item_id_fkey";

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "text" TEXT;

-- DropTable
DROP TABLE "content_block_media";

-- DropTable
DROP TABLE "content_blocks";

-- CreateTable
CREATE TABLE "content_item_media" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "has_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_item_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_item_media_content_item_id_idx" ON "content_item_media"("content_item_id");

-- CreateIndex
CREATE INDEX "content_item_media_media_id_idx" ON "content_item_media"("media_id");

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
