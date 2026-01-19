-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('healthy', 'degraded', 'down');

-- AlterTable
ALTER TABLE "container" ADD COLUMN     "labels" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "networks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "service_id" INTEGER;

-- CreateTable
CREATE TABLE "service" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "compose_project" TEXT,
    "compose_service" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'healthy',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_server_id_compose_project_compose_service_key" ON "service"("server_id", "compose_project", "compose_service");

-- AddForeignKey
ALTER TABLE "container" ADD CONSTRAINT "container_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
