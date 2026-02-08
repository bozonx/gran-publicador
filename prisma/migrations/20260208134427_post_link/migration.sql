/*
  Warnings:

  - You are about to drop the column `translation_group_id` on the `publications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RelationGroupType" AS ENUM ('SERIES', 'LOCALIZATION');

-- DropIndex
DROP INDEX "publications_translation_group_id_idx";

-- AlterTable
ALTER TABLE "publications" DROP COLUMN "translation_group_id";

-- CreateTable
CREATE TABLE "publication_relation_groups" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "RelationGroupType" NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_relation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_relation_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_relation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publication_relation_groups_project_id_type_idx" ON "publication_relation_groups"("project_id", "type");

-- CreateIndex
CREATE INDEX "publication_relation_items_publication_id_idx" ON "publication_relation_items"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_relation_items_group_id_publication_id_key" ON "publication_relation_items"("group_id", "publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_relation_items_group_id_position_key" ON "publication_relation_items"("group_id", "position");

-- AddForeignKey
ALTER TABLE "publication_relation_groups" ADD CONSTRAINT "publication_relation_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_relation_items" ADD CONSTRAINT "publication_relation_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "publication_relation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_relation_items" ADD CONSTRAINT "publication_relation_items_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
