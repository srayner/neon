import cron from 'node-cron';
import { syncDockerContainers } from '../lib/docker-sync';
import { collectServerMetrics } from '../lib/server-metrics';

async function collectAllMetrics() {
  // Collect server metrics
  try {
    await collectServerMetrics();
  } catch (error) {
    console.error('[Sync Service] Server metrics collection failed:', error);
  }

  // Sync containers (after server is ensured to exist)
  try {
    await syncDockerContainers();
  } catch (error) {
    console.error('[Sync Service] Container sync failed:', error);
  }
}

async function main() {
  console.log('[Sync Service] Starting monitoring service...');
  console.log('[Sync Service] - Server metrics: every 60 seconds');
  console.log('[Sync Service] - Docker containers: every 5 minutes');

  // Run immediately on startup
  await collectAllMetrics();

  // Collect server metrics every 60 seconds
  cron.schedule('*/1 * * * *', async () => {
    try {
      await collectServerMetrics();
    } catch (error) {
      console.error('[Sync Service] Server metrics collection failed:', error);
    }
  });

  // Sync containers every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await syncDockerContainers();
    } catch (error) {
      console.error('[Sync Service] Container sync failed:', error);
    }
  });

  console.log('[Sync Service] Service is running... Press Ctrl+C to stop');
}

main();
