-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('warning', 'critical', 'success', 'info');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('server', 'container', 'service');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('restart', 'status_change', 'version_change', 'health_change', 'created', 'removed', 'online', 'offline');

-- AlterTable
ALTER TABLE "container" ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "activity" (
    "id" SERIAL NOT NULL,
    "type" "ActivityType" NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "event_type" "EventType" NOT NULL,
    "message" TEXT NOT NULL,
    "server_id" INTEGER NOT NULL,
    "container_id" INTEGER,
    "service_id" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_server_id_created_at_idx" ON "activity"("server_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_created_at_idx" ON "activity"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
