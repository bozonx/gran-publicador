-- Drop deprecated posts.template column (per-post template override is no longer supported)
ALTER TABLE "posts" DROP COLUMN IF EXISTS "template";
