/*
  Warnings:

  - Made the column `normalized_name` on table `tags` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "normalized_name" SET NOT NULL;
