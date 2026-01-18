import type {
  ServerInfo,
  ServerMetrics,
  ContainerInfo,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  MetricsReportRequest,
  ContainersReportRequest,
  ApiResponse,
  AgentHeartbeatResponse,
} from '@neon/shared';
import type { AgentConfig } from '../config.js';

/**
 * HTTP client for communicating with master server
 */
export class MasterClient {
  private config: AgentConfig;
  private version: string;
  private token: string | null = null;
  private serverId: number | null = null;

  constructor(config: AgentConfig, version: string) {
    this.config = config;
    this.version = version;
  }

  /**
   * Register this agent with the master server
   */
  async register(serverInfo: ServerInfo): Promise<void> {
    const url = `${this.config.masterUrl}/api/agent/register`;

    const body: AgentRegistrationRequest = {
      serverName: this.config.serverName,
      serverInfo,
      agentVersion: this.version,
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': this.config.agentSecret,
      },
      body: JSON.stringify(body),
    });

    const result: ApiResponse<AgentRegistrationResponse> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(`Registration failed: ${result.error || 'Unknown error'}`);
    }

    this.token = result.data.token;
    this.serverId = result.data.serverId;

    console.log(`[Client] Registered successfully (serverId: ${this.serverId})`);
  }

  /**
   * Send metrics to master
   */
  async sendMetrics(metrics: ServerMetrics[]): Promise<void> {
    if (!this.token) {
      throw new Error('Not registered - call register() first');
    }

    const url = `${this.config.masterUrl}/api/agent/metrics`;

    const body: MetricsReportRequest = { metrics };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const result: ApiResponse = await response.json();

    if (!result.success) {
      throw new Error(`Failed to send metrics: ${result.error || 'Unknown error'}`);
    }
  }

  /**
   * Send container data to master
   */
  async sendContainers(containers: ContainerInfo[]): Promise<void> {
    if (!this.token) {
      throw new Error('Not registered - call register() first');
    }

    const url = `${this.config.masterUrl}/api/agent/containers`;

    const body: ContainersReportRequest = { containers };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const result: ApiResponse = await response.json();

    if (!result.success) {
      throw new Error(`Failed to send containers: ${result.error || 'Unknown error'}`);
    }
  }

  /**
   * Send heartbeat to master
   */
  async heartbeat(): Promise<{ tokenExpiresIn: number }> {
    if (!this.token) {
      throw new Error('Not registered - call register() first');
    }

    const url = `${this.config.masterUrl}/api/agent/heartbeat`;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        agentVersion: this.version,
      }),
    });

    const result: ApiResponse<AgentHeartbeatResponse> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(`Heartbeat failed: ${result.error || 'Unknown error'}`);
    }

    return { tokenExpiresIn: result.data.tokenExpiresIn };
  }

  /**
   * Check if client is registered
   */
  isRegistered(): boolean {
    return this.token !== null;
  }

  /**
   * Clear registration (forces re-registration)
   */
  clearRegistration(): void {
    this.token = null;
    this.serverId = null;
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, options);

        // If unauthorized, clear token so we can re-register
        if (response.status === 401) {
          this.clearRegistration();
          throw new Error('Unauthorized - token expired or invalid');
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[Client] Request failed (attempt ${attempt}/${this.config.retryAttempts}): ${lastError.message}`);

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
