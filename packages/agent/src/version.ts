import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let cachedVersion: string | null = null;

/**
 * Get the agent version.
 * In bundled mode, uses the injected AGENT_VERSION env var.
 * In dev mode, reads from the root package.json.
 */
export async function getVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  // Check for injected version (bundled mode)
  if (process.env.AGENT_VERSION) {
    cachedVersion = process.env.AGENT_VERSION;
    return cachedVersion;
  }

  // Dev mode: read from root package.json
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const rootPkgPath = join(__dirname, '../../../package.json');
    const rootPkg = JSON.parse(await readFile(rootPkgPath, 'utf-8'));
    const version: string = rootPkg.version ?? 'unknown';
    cachedVersion = version;
    return version;
  } catch {
    return 'unknown';
  }
}
