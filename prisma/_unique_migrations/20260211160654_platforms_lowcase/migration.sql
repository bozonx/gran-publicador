/*
  Warnings:

  - The values [TELEGRAM,VK,YOUTUBE,TIKTOK,FACEBOOK,SITE] on the enum `SocialMedia` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SocialMedia_new" AS ENUM ('telegram', 'vk', 'site');
ALTER TABLE "channels" ALTER COLUMN "social_media" TYPE "SocialMedia_new" USING ("social_media"::text::"SocialMedia_new");
ALTER TYPE "SocialMedia" RENAME TO "SocialMedia_old";
ALTER TYPE "SocialMedia_new" RENAME TO "SocialMedia";
DROP TYPE "public"."SocialMedia_old";
COMMIT;
