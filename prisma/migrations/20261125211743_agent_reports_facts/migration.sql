-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'monitoring_gap';

-- AlterTable
ALTER TABLE "container" ADD COLUMN     "finished_at" TIMESTAMP(3),
ADD COLUMN     "oom_killed" BOOLEAN,
ADD COLUMN     "restart_count" INTEGER,
ADD COLUMN     "stop_request" TEXT;

-- AlterTable
ALTER TABLE "server" ADD COLUMN     "docker_reachable" BOOLEAN,
ADD COLUMN     "docker_reachable_changed_at" TIMESTAMP(3),
ADD COLUMN     "heartbeat_interval_seconds" INTEGER;
