/**
 * Agent configuration loaded from environment variables
 */
export interface AgentConfig {
  // Required
  serverName: string;
  masterUrl: string;
  agentSecret: string;

  // Optional with defaults
  metricsIntervalSeconds: number;
  containersIntervalSeconds: number;
  heartbeatIntervalSeconds: number;

  // Buffering
  bufferEnabled: boolean;
  bufferMaxSize: number;

  // Retry
  retryAttempts: number;
  retryDelayMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`[Config] Invalid integer for ${name}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function optionalEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.toLowerCase();
  if (!value) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

export function loadConfig(): AgentConfig {
  return {
    // Required
    serverName: requireEnv('SERVER_NAME'),
    masterUrl: requireEnv('MASTER_URL'),
    agentSecret: requireEnv('AGENT_SECRET'),

    // Intervals
    metricsIntervalSeconds: optionalEnvInt('METRICS_INTERVAL', 300),
    containersIntervalSeconds: optionalEnvInt('CONTAINERS_INTERVAL', 900),
    heartbeatIntervalSeconds: optionalEnvInt('HEARTBEAT_INTERVAL', 60),

    // Buffering
    bufferEnabled: optionalEnvBool('BUFFER_ENABLED', true),
    bufferMaxSize: optionalEnvInt('BUFFER_MAX_SIZE', 100),

    // Retry
    retryAttempts: optionalEnvInt('RETRY_ATTEMPTS', 3),
    retryDelayMs: optionalEnvInt('RETRY_DELAY_MS', 1000),
  };
}

export function printConfig(config: AgentConfig): void {
  console.log('[Config] Agent configuration:');
  console.log(`  Server Name: ${config.serverName}`);
  console.log(`  Master URL: ${config.masterUrl}`);
  console.log(`  Metrics Interval: ${config.metricsIntervalSeconds}s`);
  console.log(`  Containers Interval: ${config.containersIntervalSeconds}s`);
  console.log(`  Heartbeat Interval: ${config.heartbeatIntervalSeconds}s`);
  console.log(`  Buffer Enabled: ${config.bufferEnabled}`);
  console.log(`  Buffer Max Size: ${config.bufferMaxSize}`);
}
