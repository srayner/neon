-- AlterTable
ALTER TABLE "container" ADD COLUMN     "image_id" TEXT,
ADD COLUMN     "image_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "version" TEXT;
