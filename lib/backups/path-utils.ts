import path from 'path';
import fs from 'fs/promises';

/**
 * Get the backup root directory from environment variable
 */
export function getBackupRoot(): string {
  const backupRoot = process.env.BACKUP_ROOT;
  if (!backupRoot) {
    throw new Error('BACKUP_ROOT environment variable is not configured');
  }
  return backupRoot;
}

/**
 * Validates and resolves a relative path within the backup root.
 * Prevents path traversal attacks by ensuring the resolved path
 * stays within BACKUP_ROOT.
 *
 * @param relativePath - The relative path from the client
 * @returns The validated absolute path
 * @throws Error if path is invalid or escapes BACKUP_ROOT
 */
export function validateAndResolvePath(relativePath: string): string {
  const backupRoot = getBackupRoot();

  // Reject null byte injection attempts
  if (relativePath.includes('\0')) {
    throw new Error('Invalid path: contains null bytes');
  }

  // Decode URI components safely
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(relativePath);
  } catch {
    throw new Error('Invalid path: malformed URI encoding');
  }

  // Normalize and resolve the path
  const normalizedBackupRoot = path.resolve(backupRoot);
  const resolvedPath = path.resolve(normalizedBackupRoot, decodedPath);

  // Verify the resolved path is within BACKUP_ROOT
  if (!resolvedPath.startsWith(normalizedBackupRoot + path.sep) && resolvedPath !== normalizedBackupRoot) {
    throw new Error('Invalid path: access denied');
  }

  return resolvedPath;
}

/**
 * Checks if a path exists and returns its stats
 */
export async function pathExists(absolutePath: string): Promise<{ exists: boolean; isDirectory: boolean; isFile: boolean }> {
  try {
    const stats = await fs.stat(absolutePath);
    return {
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  } catch {
    return {
      exists: false,
      isDirectory: false,
      isFile: false,
    };
  }
}

/**
 * Gets the relative path from BACKUP_ROOT
 */
export function getRelativePath(absolutePath: string): string {
  const backupRoot = path.resolve(getBackupRoot());
  const relative = path.relative(backupRoot, absolutePath);
  return relative || '.';
}

/**
 * Gets the parent path, returns null if at root
 */
export function getParentPath(relativePath: string): string | null {
  if (!relativePath || relativePath === '.' || relativePath === '/') {
    return null;
  }
  const parent = path.dirname(relativePath);
  if (parent === '.' || parent === relativePath) {
    return null;
  }
  return parent;
}
