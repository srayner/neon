import { loadConfig, printConfig } from './config.js';
import { MasterClient } from './transport/client.js';
import { Scheduler } from './scheduler.js';
import { getVersion } from './version.js';

async function main() {
  const version = await getVersion();
  console.log('====================================');
  console.log(`  Neon Agent v${version}`);
  console.log('====================================');
  console.log('');

  // Load configuration
  const config = loadConfig();
  printConfig(config);
  console.log('');

  // Create client and scheduler
  const client = new MasterClient(config, version);
  const scheduler = new Scheduler(config, client);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n[Agent] Shutting down...');
    scheduler.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the scheduler
  try {
    await scheduler.start();
    console.log('');
    console.log('[Agent] Running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('[Agent] Failed to start:', (error as Error).message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[Agent] Unhandled error:', error);
  process.exit(1);
});
