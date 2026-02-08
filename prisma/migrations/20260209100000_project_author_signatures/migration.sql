-- DropTable
DROP TABLE IF EXISTS "author_signatures";

-- CreateTable
CREATE TABLE "project_author_signatures" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_author_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_author_signature_variants" (
    "id" TEXT NOT NULL,
    "signature_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_author_signature_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_author_signatures_project_id_user_id_idx" ON "project_author_signatures"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_author_signatures_project_id_order_idx" ON "project_author_signatures"("project_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "project_author_signature_variants_signature_id_language_key" ON "project_author_signature_variants"("signature_id", "language");

-- AddForeignKey
ALTER TABLE "project_author_signatures" ADD CONSTRAINT "project_author_signatures_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_author_signatures" ADD CONSTRAINT "project_author_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_author_signature_variants" ADD CONSTRAINT "project_author_signature_variants_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "project_author_signatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
