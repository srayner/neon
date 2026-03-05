-- DropIndex
DROP INDEX "server_metric_server_id_timestamp_idx";

-- CreateIndex
CREATE INDEX "server_metric_server_id_timestamp_idx" ON "server_metric"("server_id", "timestamp");
