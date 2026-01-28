/*
  Warnings:

  - You are about to drop the column `is_default` on the `project_news_queries` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_NEWS';

-- AlterTable
ALTER TABLE "project_news_queries" DROP COLUMN "is_default";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en-US';
