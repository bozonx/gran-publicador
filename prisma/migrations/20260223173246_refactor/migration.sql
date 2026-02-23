/*
  Warnings:

  - The values [FS] on the enum `StorageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
  -- Add the new value to the existing enum TYPE first (PostgreSQL allows this)
  ALTER TYPE "StorageType" ADD VALUE IF NOT EXISTS 'STORAGE';
COMMIT;

-- Update data
UPDATE "media" SET "storage_type" = 'STORAGE' WHERE "storage_type" = 'FS';

-- Remove old value (this is tricky in PG, usually done via a new type)
BEGIN;
  CREATE TYPE "StorageType_new" AS ENUM ('STORAGE', 'TELEGRAM');
  ALTER TABLE "media" ALTER COLUMN "storage_type" TYPE "StorageType_new" USING ("storage_type"::text::"StorageType_new");
  ALTER TYPE "StorageType" RENAME TO "StorageType_old";
  ALTER TYPE "StorageType_new" RENAME TO "StorageType";
  DROP TYPE "StorageType_old";
COMMIT;
