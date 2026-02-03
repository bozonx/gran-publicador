-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "title" TEXT,
    "tags" TEXT,
    "note" TEXT,
    "meta" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_texts" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "type" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_texts_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "publication_content_items" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_items_user_id_created_at_idx" ON "content_items"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "content_items_project_id_created_at_idx" ON "content_items"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "content_items_archived_at_idx" ON "content_items"("archived_at");

-- CreateIndex
CREATE INDEX "content_texts_content_item_id_idx" ON "content_texts"("content_item_id");

-- CreateIndex
CREATE INDEX "content_texts_type_idx" ON "content_texts"("type");

-- CreateIndex
CREATE INDEX "content_item_media_content_item_id_idx" ON "content_item_media"("content_item_id");

-- CreateIndex
CREATE INDEX "content_item_media_media_id_idx" ON "content_item_media"("media_id");

-- CreateIndex
CREATE INDEX "publication_content_items_publication_id_idx" ON "publication_content_items"("publication_id");

-- CreateIndex
CREATE INDEX "publication_content_items_content_item_id_idx" ON "publication_content_items"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_content_items_publication_id_content_item_id_key" ON "publication_content_items"("publication_id", "content_item_id");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_texts" ADD CONSTRAINT "content_texts_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_content_items" ADD CONSTRAINT "publication_content_items_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_content_items" ADD CONSTRAINT "publication_content_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
