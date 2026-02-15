CREATE TABLE "news_notification_user_states" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "query_id" TEXT NOT NULL,
  "last_sent_saved_at" TIMESTAMP(3) NOT NULL,
  "last_sent_news_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "news_notification_user_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_notification_user_states_user_id_query_id_key"
  ON "news_notification_user_states"("user_id", "query_id");

CREATE INDEX "news_notification_user_states_query_id_idx"
  ON "news_notification_user_states"("query_id");

CREATE INDEX "news_notification_user_states_user_id_idx"
  ON "news_notification_user_states"("user_id");

ALTER TABLE "news_notification_user_states"
  ADD CONSTRAINT "news_notification_user_states_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_notification_user_states"
  ADD CONSTRAINT "news_notification_user_states_query_id_fkey"
  FOREIGN KEY ("query_id") REFERENCES "project_news_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
