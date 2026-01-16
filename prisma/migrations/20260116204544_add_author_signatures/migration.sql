-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "author_signature_id" TEXT;

-- CreateTable
CREATE TABLE "author_signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,

    CONSTRAINT "author_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "author_signatures_user_id_channel_id_idx" ON "author_signatures"("user_id", "channel_id");

-- CreateIndex
CREATE INDEX "author_signatures_channel_id_idx" ON "author_signatures"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "author_signatures_user_id_channel_id_name_key" ON "author_signatures"("user_id", "channel_id", "name");

-- CreateIndex
CREATE INDEX "posts_author_signature_id_idx" ON "posts"("author_signature_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_signature_id_fkey" FOREIGN KEY ("author_signature_id") REFERENCES "author_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_signatures" ADD CONSTRAINT "author_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_signatures" ADD CONSTRAINT "author_signatures_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
