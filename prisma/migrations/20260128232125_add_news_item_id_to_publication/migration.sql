-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "news_item_id" TEXT;

-- CreateIndex
CREATE INDEX "publications_news_item_id_idx" ON "publications"("news_item_id");
