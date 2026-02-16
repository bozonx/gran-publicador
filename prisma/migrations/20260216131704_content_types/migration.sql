-- CreateEnum
CREATE TYPE "ContentLibraryGroupType" AS ENUM ('PERSONAL_USER', 'PROJECT_USER', 'PROJECT_SHARED');

-- AlterTable
ALTER TABLE "content_library_tabs" ADD COLUMN     "group_type" "ContentLibraryGroupType";
