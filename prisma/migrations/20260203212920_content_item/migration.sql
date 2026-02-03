/*
  Warnings:

  - You are about to drop the `content_item_media` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `content_texts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_item_media" DROP CONSTRAINT "content_item_media_content_item_id_fkey";

-- DropForeignKey
ALTER TABLE "content_item_media" DROP CONSTRAINT "content_item_media_media_id_fkey";

-- DropForeignKey
ALTER TABLE "content_texts" DROP CONSTRAINT "content_texts_content_item_id_fkey";

-- DropTable
DROP TABLE "content_item_media";

-- DropTable
DROP TABLE "content_texts";

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "type" TEXT,
    "text" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_block_media" (
    "id" TEXT NOT NULL,
    "content_block_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "has_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_block_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_blocks_content_item_id_idx" ON "content_blocks"("content_item_id");

-- CreateIndex
CREATE INDEX "content_blocks_type_idx" ON "content_blocks"("type");

-- CreateIndex
CREATE INDEX "content_block_media_content_block_id_idx" ON "content_block_media"("content_block_id");

-- CreateIndex
CREATE INDEX "content_block_media_media_id_idx" ON "content_block_media"("media_id");

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_media" ADD CONSTRAINT "content_block_media_content_block_id_fkey" FOREIGN KEY ("content_block_id") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_media" ADD CONSTRAINT "content_block_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
