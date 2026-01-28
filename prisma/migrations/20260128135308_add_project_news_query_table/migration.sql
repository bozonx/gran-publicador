-- CreateTable
CREATE TABLE "project_news_queries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "is_notification_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_news_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_news_queries_project_id_idx" ON "project_news_queries"("project_id");

-- CreateIndex
CREATE INDEX "project_news_queries_is_notification_enabled_last_checked_a_idx" ON "project_news_queries"("is_notification_enabled", "last_checked_at");

-- AddForeignKey
ALTER TABLE "project_news_queries" ADD CONSTRAINT "project_news_queries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
