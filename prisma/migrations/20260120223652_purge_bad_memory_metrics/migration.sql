-- Purge historical metrics data that used incorrect memory calculation
-- Previous code used mem.used (includes buffers/cache) instead of mem.active

TRUNCATE TABLE server_metric;