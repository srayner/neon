-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('application', 'database', 'website', 'agent', 'infrastructure');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('requires', 'uses', 'optional');

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "description" TEXT,
ADD COLUMN     "service_type" "ServiceType";

-- CreateTable
CREATE TABLE "service_dependency" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "depends_on_id" INTEGER NOT NULL,
    "dependency_type" "DependencyType" NOT NULL DEFAULT 'requires',
    "inferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_dependency_service_id_depends_on_id_key" ON "service_dependency"("service_id", "depends_on_id");

-- AddForeignKey
ALTER TABLE "service_dependency" ADD CONSTRAINT "service_dependency_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependency" ADD CONSTRAINT "service_dependency_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
