-- CreateEnum
CREATE TYPE "SocialMedia" AS ENUM ('TELEGRAM', 'VK', 'SITE');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('POST', 'ARTICLE', 'NEWS', 'VIDEO', 'SHORT', 'STORY');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'PARTIAL', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PENDING', 'FAILED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PublicationRelationGroupType" AS ENUM ('SERIES', 'LOCALIZATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PUBLICATION_FAILED', 'PROJECT_INVITE', 'SYSTEM', 'NEW_NEWS');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('STORAGE', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "TagDomain" AS ENUM ('CONTENT_LIBRARY', 'PUBLICATIONS');

-- CreateEnum
CREATE TYPE "ContentCollectionType" AS ENUM ('GROUP', 'SAVED_VIEW', 'PUBLICATION_MEDIA_VIRTUAL', 'UNSPLASH');

-- CreateEnum
CREATE TYPE "ContentCollectionGroupType" AS ENUM ('PERSONAL_USER', 'PROJECT_USER', 'PROJECT_SHARED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT,
    "telegram_username" TEXT,
    "telegram_id" BIGINT,
    "avatar_url" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "ui_language" TEXT NOT NULL DEFAULT 'en-US',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hashed_refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_api_tokens" (
    "id" TEXT NOT NULL,
    "api_token_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "all_projects" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "system_type" TEXT,
    "permissions" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "post_type" "PostType",
    "order" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT,
    "template" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_template_variations" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_template_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_signatures" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_signature_variants" (
    "id" TEXT NOT NULL,
    "signature_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_signature_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_news_queries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_notification_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_news_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_query_notification_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "last_sent_saved_at" TIMESTAMP(3) NOT NULL,
    "last_sent_news_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_query_notification_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "name" TEXT,
    "note" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "prompt" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "social_media" "SocialMedia" NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "channel_identifier" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT,
    "published_posts_count" INTEGER NOT NULL DEFAULT 0,
    "failed_posts_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "news_item_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_started_at" TIMESTAMP(3),
    "post_type" "PostType" NOT NULL DEFAULT 'POST',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "project_template_id" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "content" TEXT,
    "author_comment" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "post_date" TIMESTAMP(3),
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "social_media" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "content" TEXT,
    "platform_options" JSONB,
    "author_signature" TEXT,
    "posting_snapshot" JSONB,
    "posting_snapshot_created_at" TIMESTAMP(3),
    "prepared_payload" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_collections" (
    "id" TEXT NOT NULL,
    "type" "ContentCollectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "group_type" "ContentCollectionGroupType",
    "user_id" TEXT,
    "project_id" TEXT,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_collections_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "title" TEXT,
    "note" TEXT,
    "text" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_collection_items" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_collection_items_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "storage_type" "StorageType" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "filename" TEXT,
    "alt" TEXT,
    "description" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_media" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "has_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_relation_groups" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "PublicationRelationGroupType" NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_relation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_relation_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_relation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "project_id" TEXT,
    "user_id" TEXT,
    "domain" "TagDomain" NOT NULL DEFAULT 'PUBLICATIONS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PublicationToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PublicationToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PostToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PostToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContentItemToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContentItemToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_telegram_username_idx" ON "users"("telegram_username");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "project_api_tokens_api_token_id_idx" ON "project_api_tokens"("api_token_id");

-- CreateIndex
CREATE INDEX "project_api_tokens_project_id_idx" ON "project_api_tokens"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_api_tokens_api_token_id_project_id_key" ON "project_api_tokens"("api_token_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_hashed_token_key" ON "api_tokens"("hashed_token");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE INDEX "project_members_role_id_idx" ON "project_members"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_project_id_idx" ON "roles"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_project_id_name_key" ON "roles"("project_id", "name");

-- CreateIndex
CREATE INDEX "project_templates_project_id_idx" ON "project_templates"("project_id");

-- CreateIndex
CREATE INDEX "channel_template_variations_channel_id_idx" ON "channel_template_variations"("channel_id");

-- CreateIndex
CREATE INDEX "channel_template_variations_project_template_id_idx" ON "channel_template_variations"("project_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_template_variations_channel_id_project_template_id_key" ON "channel_template_variations"("channel_id", "project_template_id");

-- CreateIndex
CREATE INDEX "author_signatures_project_id_user_id_idx" ON "author_signatures"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "author_signatures_project_id_order_idx" ON "author_signatures"("project_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "author_signature_variants_signature_id_language_key" ON "author_signature_variants"("signature_id", "language");

-- CreateIndex
CREATE INDEX "project_news_queries_project_id_idx" ON "project_news_queries"("project_id");

-- CreateIndex
CREATE INDEX "project_news_queries_is_notification_enabled_last_checked_a_idx" ON "project_news_queries"("is_notification_enabled", "last_checked_at");

-- CreateIndex
CREATE INDEX "news_query_notification_states_query_id_idx" ON "news_query_notification_states"("query_id");

-- CreateIndex
CREATE INDEX "news_query_notification_states_user_id_idx" ON "news_query_notification_states"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_query_notification_states_user_id_query_id_key" ON "news_query_notification_states"("user_id", "query_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_prompt_templates_user_id_idx" ON "llm_prompt_templates"("user_id");

-- CreateIndex
CREATE INDEX "llm_prompt_templates_project_id_idx" ON "llm_prompt_templates"("project_id");

-- CreateIndex
CREATE INDEX "channels_project_id_idx" ON "channels"("project_id");

-- CreateIndex
CREATE INDEX "publications_project_id_status_idx" ON "publications"("project_id", "status");

-- CreateIndex
CREATE INDEX "publications_project_id_created_at_idx" ON "publications"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "publications_project_id_scheduled_at_idx" ON "publications"("project_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "publications_project_id_effective_at_idx" ON "publications"("project_id", "effective_at");

-- CreateIndex
CREATE INDEX "publications_effective_at_idx" ON "publications"("effective_at");

-- CreateIndex
CREATE INDEX "publications_created_by_project_id_archived_at_idx" ON "publications"("created_by", "project_id", "archived_at");

-- CreateIndex
CREATE INDEX "publications_news_item_id_idx" ON "publications"("news_item_id");

-- CreateIndex
CREATE INDEX "publications_project_template_id_idx" ON "publications"("project_template_id");

-- CreateIndex
CREATE INDEX "posts_status_scheduled_at_idx" ON "posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "posts_channel_id_created_at_idx" ON "posts"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_publication_id_idx" ON "posts"("publication_id");

-- CreateIndex
CREATE INDEX "content_collections_user_id_order_idx" ON "content_collections"("user_id", "order");

-- CreateIndex
CREATE INDEX "content_collections_project_id_order_idx" ON "content_collections"("project_id", "order");

-- CreateIndex
CREATE INDEX "content_collections_parent_id_order_idx" ON "content_collections"("parent_id", "order");

-- CreateIndex
CREATE INDEX "publication_content_items_publication_id_idx" ON "publication_content_items"("publication_id");

-- CreateIndex
CREATE INDEX "publication_content_items_content_item_id_idx" ON "publication_content_items"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_content_items_publication_id_content_item_id_key" ON "publication_content_items"("publication_id", "content_item_id");

-- CreateIndex
CREATE INDEX "content_items_user_id_created_at_idx" ON "content_items"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "content_items_project_id_created_at_idx" ON "content_items"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "content_items_archived_at_idx" ON "content_items"("archived_at");

-- CreateIndex
CREATE INDEX "content_collection_items_content_item_id_idx" ON "content_collection_items"("content_item_id");

-- CreateIndex
CREATE INDEX "content_collection_items_collection_id_idx" ON "content_collection_items"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_collection_items_content_item_id_collection_id_key" ON "content_collection_items"("content_item_id", "collection_id");

-- CreateIndex
CREATE INDEX "content_item_media_content_item_id_idx" ON "content_item_media"("content_item_id");

-- CreateIndex
CREATE INDEX "content_item_media_media_id_idx" ON "content_item_media"("media_id");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- CreateIndex
CREATE INDEX "media_storage_type_idx" ON "media"("storage_type");

-- CreateIndex
CREATE INDEX "publication_media_publication_id_idx" ON "publication_media"("publication_id");

-- CreateIndex
CREATE INDEX "publication_media_media_id_idx" ON "publication_media"("media_id");

-- CreateIndex
CREATE INDEX "publication_relation_groups_project_id_type_idx" ON "publication_relation_groups"("project_id", "type");

-- CreateIndex
CREATE INDEX "publication_relation_items_publication_id_idx" ON "publication_relation_items"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_relation_items_group_id_publication_id_key" ON "publication_relation_items"("group_id", "publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_relation_items_group_id_order_key" ON "publication_relation_items"("group_id", "order");

-- CreateIndex
CREATE INDEX "tags_normalized_name_idx" ON "tags"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_project_id_domain_normalized_name_key" ON "tags"("project_id", "domain", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_domain_normalized_name_key" ON "tags"("user_id", "domain", "normalized_name");

-- CreateIndex
CREATE INDEX "_PublicationToTag_B_index" ON "_PublicationToTag"("B");

-- CreateIndex
CREATE INDEX "_PostToTag_B_index" ON "_PostToTag"("B");

-- CreateIndex
CREATE INDEX "_ContentItemToTag_B_index" ON "_ContentItemToTag"("B");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_api_tokens" ADD CONSTRAINT "project_api_tokens_api_token_id_fkey" FOREIGN KEY ("api_token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_api_tokens" ADD CONSTRAINT "project_api_tokens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_template_variations" ADD CONSTRAINT "channel_template_variations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_template_variations" ADD CONSTRAINT "channel_template_variations_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_signatures" ADD CONSTRAINT "author_signatures_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_signatures" ADD CONSTRAINT "author_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_signature_variants" ADD CONSTRAINT "author_signature_variants_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "author_signatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_news_queries" ADD CONSTRAINT "project_news_queries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_query_notification_states" ADD CONSTRAINT "news_query_notification_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_query_notification_states" ADD CONSTRAINT "news_query_notification_states_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "project_news_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_templates" ADD CONSTRAINT "llm_prompt_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_templates" ADD CONSTRAINT "llm_prompt_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collections" ADD CONSTRAINT "content_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collections" ADD CONSTRAINT "content_collections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collections" ADD CONSTRAINT "content_collections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_content_items" ADD CONSTRAINT "publication_content_items_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_content_items" ADD CONSTRAINT "publication_content_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collection_items" ADD CONSTRAINT "content_collection_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collection_items" ADD CONSTRAINT "content_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "content_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_media" ADD CONSTRAINT "content_item_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_relation_groups" ADD CONSTRAINT "publication_relation_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_relation_items" ADD CONSTRAINT "publication_relation_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "publication_relation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_relation_items" ADD CONSTRAINT "publication_relation_items_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PublicationToTag" ADD CONSTRAINT "_PublicationToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PublicationToTag" ADD CONSTRAINT "_PublicationToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemToTag" ADD CONSTRAINT "_ContentItemToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemToTag" ADD CONSTRAINT "_ContentItemToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
