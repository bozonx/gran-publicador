/*
  Warnings:

  - You are about to drop the column `archived_at` on the `author_signatures` table. All the data in the column will be lost.
  - You are about to drop the column `archived_by` on the `author_signatures` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "author_signatures" DROP COLUMN "archived_at",
DROP COLUMN "archived_by";
