-- An agent resends a Docker gap until Neon accepts it, so the same gap can
-- arrive twice (e.g. Neon stored it but the reply was lost). One activity per
-- gap per server. Prisma's schema can't express a partial index on JSON keys.
-- Kept apart from the migration that adds 'monitoring_gap': Postgres can't use
-- a new enum value in the transaction that adds it.
CREATE UNIQUE INDEX "activity_one_monitoring_gap" ON "activity"("server_id", ("metadata"->>'from'), ("metadata"->>'to')) WHERE "event_type" = 'monitoring_gap';
