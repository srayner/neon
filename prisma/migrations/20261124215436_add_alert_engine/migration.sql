-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('condition', 'event');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('opened', 'resolved');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'alert_opened';
ALTER TYPE "EventType" ADD VALUE 'alert_resolved';
ALTER TYPE "EventType" ADD VALUE 'alert_event';

-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "alert_id" INTEGER;

-- CreateTable
CREATE TABLE "alert" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "server_id" INTEGER NOT NULL,
    "subject_key" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_notification" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "alert_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "crash_loop_count" INTEGER NOT NULL,
    "crash_loop_window_minutes" INTEGER NOT NULL,
    "missed_heartbeats" INTEGER NOT NULL,
    "high_usage_minutes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_server_id_opened_at_idx" ON "alert"("server_id", "opened_at" DESC);

-- CreateIndex
CREATE INDEX "alert_notification_status_created_at_idx" ON "alert_notification"("status", "created_at");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notification" ADD CONSTRAINT "alert_notification_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one open alert per alert ID per subject (docs/alerts.md section 5).
-- A partial unique index, which Prisma's schema can't express.
CREATE UNIQUE INDEX "alert_one_open_per_subject" ON "alert"("code", "server_id", "subject_key") WHERE "status" = 'open';
