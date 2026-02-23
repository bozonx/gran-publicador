/*
  Warnings:

  - Changed the type of `type` on the `content_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

 */
 -- CreateEnum
 DO $$
 BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentCollectionType') THEN
     CREATE TYPE "ContentCollectionType" AS ENUM ('GROUP', 'SAVED_VIEW');
   END IF;
 END $$;

 -- Rename constraints/indexes if they still use the legacy names
 DO $$
 BEGIN
   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_library_tabs_pkey') THEN
     ALTER TABLE "content_collections" RENAME CONSTRAINT "content_library_tabs_pkey" TO "content_collections_pkey";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_library_tabs_parent_id_fkey') THEN
     ALTER TABLE "content_collections" RENAME CONSTRAINT "content_library_tabs_parent_id_fkey" TO "content_collections_parent_id_fkey";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_library_tabs_project_id_fkey') THEN
     ALTER TABLE "content_collections" RENAME CONSTRAINT "content_library_tabs_project_id_fkey" TO "content_collections_project_id_fkey";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_library_tabs_user_id_fkey') THEN
     ALTER TABLE "content_collections" RENAME CONSTRAINT "content_library_tabs_user_id_fkey" TO "content_collections_user_id_fkey";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_item_groups_tab_id_fkey') THEN
     ALTER TABLE "content_item_groups" RENAME CONSTRAINT "content_item_groups_tab_id_fkey" TO "content_item_groups_collection_id_fkey";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'content_library_tabs_parent_id_order_idx') THEN
     ALTER INDEX "content_library_tabs_parent_id_order_idx" RENAME TO "content_collections_parent_id_order_idx";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'content_library_tabs_project_id_order_idx') THEN
     ALTER INDEX "content_library_tabs_project_id_order_idx" RENAME TO "content_collections_project_id_order_idx";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'content_library_tabs_user_id_order_idx') THEN
     ALTER INDEX "content_library_tabs_user_id_order_idx" RENAME TO "content_collections_user_id_order_idx";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'content_item_groups_content_item_id_tab_id_key') THEN
     ALTER INDEX "content_item_groups_content_item_id_tab_id_key" RENAME TO "content_item_groups_content_item_id_collection_id_key";
   END IF;

   IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'content_item_groups_tab_id_idx') THEN
     ALTER INDEX "content_item_groups_tab_id_idx" RENAME TO "content_item_groups_collection_id_idx";
   END IF;
 END $$;

 -- Alter enum type for content_collections.type (safe cast via text)
 ALTER TABLE "content_collections"
 ALTER COLUMN "type" TYPE "ContentCollectionType" USING ("type"::text::"ContentCollectionType");

 -- Drop legacy enum if present
 DO $$
 BEGIN
   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentLibraryTabType') THEN
     DROP TYPE "ContentLibraryTabType";
   END IF;
 END $$;
