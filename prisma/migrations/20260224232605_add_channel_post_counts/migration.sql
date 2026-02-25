-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "failed_posts_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "published_posts_count" INTEGER NOT NULL DEFAULT 0;

-- Populate existing counts
UPDATE "channels" c
SET 
  "published_posts_count" = COALESCE((SELECT COUNT(id) FROM "posts" p WHERE p.channel_id = c.id AND p.status = 'PUBLISHED'), 0),
  "failed_posts_count" = COALESCE((SELECT COUNT(id) FROM "posts" p WHERE p.channel_id = c.id AND p.status = 'FAILED'), 0);
