export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string; // ISO date string
  extension: string | null;
}

export interface DirectoryListing {
  path: string; // Current relative path
  parentPath: string | null;
  items: FileItem[];
}

export type FileCategory = 'archive' | 'database' | 'data' | 'log' | 'other';

export function getFileCategory(extension: string | null): FileCategory {
  if (!extension) return 'other';

  const ext = extension.toLowerCase();

  // Archives
  if (['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
    return 'archive';
  }

  // Database
  if (['sql', 'dump', 'bak', 'db', 'sqlite', 'sqlite3'].includes(ext)) {
    return 'database';
  }

  // Data
  if (['json', 'xml', 'csv', 'yaml', 'yml', 'toml'].includes(ext)) {
    return 'data';
  }

  // Logs
  if (['log', 'txt', 'out', 'err'].includes(ext)) {
    return 'log';
  }

  return 'other';
}
