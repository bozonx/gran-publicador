-- AlterTable
ALTER TABLE "posts" ADD COLUMN "posting_snapshot" JSONB,
ADD COLUMN "posting_snapshot_created_at" TIMESTAMP(3);
