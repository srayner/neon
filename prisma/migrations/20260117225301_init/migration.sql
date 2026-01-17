-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('running', 'exited', 'paused', 'restarting');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('online', 'offline', 'maintenance');

-- CreateTable
CREATE TABLE "server" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "ip_address" TEXT,
    "status" "ServerStatus" NOT NULL DEFAULT 'online',
    "cpu_cores" INTEGER,
    "total_memory_gb" DECIMAL(10,2),
    "total_disk_gb" DECIMAL(10,2),
    "current_cpu_percent" DECIMAL(5,2),
    "current_memory_percent" DECIMAL(5,2),
    "current_disk_percent" DECIMAL(5,2),
    "last_metrics_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_metric" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpu_percent" DECIMAL(5,2) NOT NULL,
    "memory_percent" DECIMAL(5,2) NOT NULL,
    "disk_percent" DECIMAL(5,2) NOT NULL,
    "memory_used_gb" DECIMAL(10,2) NOT NULL,
    "memory_total_gb" DECIMAL(10,2) NOT NULL,
    "disk_used_gb" DECIMAL(10,2) NOT NULL,
    "disk_total_gb" DECIMAL(10,2) NOT NULL,
    "network_rx_bytes" BIGINT,
    "network_tx_bytes" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container" (
    "id" SERIAL NOT NULL,
    "container_id" TEXT NOT NULL,
    "server_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "status" "ContainerStatus" NOT NULL,
    "health" TEXT,
    "ports" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_name_key" ON "server"("name");

-- CreateIndex
CREATE INDEX "server_metric_server_id_timestamp_idx" ON "server_metric"("server_id", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "container_server_id_container_id_key" ON "container"("server_id", "container_id");

-- AddForeignKey
ALTER TABLE "server_metric" ADD CONSTRAINT "server_metric_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container" ADD CONSTRAINT "container_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
