import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { FileItem } from "@/app/backups/types";

const execAsync = promisify(exec);

/**
 * Get folder sizes for all immediate children of a directory using `du`.
 * This is much more efficient than recursively walking directories in Node.js.
 *
 * @param directoryPath - Absolute path to the directory
 * @returns Map of folder names to their sizes in bytes
 */
export async function getFolderSizes(
  directoryPath: string,
): Promise<Map<string, number>> {
  const sizeMap = new Map<string, number>();

  try {
    // Use du with:
    // -s: summarize (don't show subdirectories)
    // -b: apparent size in bytes (Linux)
    // We run du on each subdirectory to get accurate sizes
    const { stdout } = await execAsync(
      `du -sb "${directoryPath}"/*/ 2>/dev/null || true`,
      { maxBuffer: 10 * 1024 * 1024 },
    );

    // Parse du output: each line is "SIZE\tPATH"
    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const size = parseInt(match[1], 10);
        // Remove trailing slash and get just the folder name
        const fullPath = match[2].replace(/\/$/, "");
        const folderName = path.basename(fullPath);
        sizeMap.set(folderName, size);
      }
    }
  } catch {
    // If du fails, we'll fall back to showing 0 for folder sizes
  }

  return sizeMap;
}

/**
 * List directory contents with file/folder metadata including folder sizes.
 *
 * @param absolutePath - Absolute path to the directory to list
 * @returns Array of FileItem objects
 */
export async function listDirectory(absolutePath: string): Promise<FileItem[]> {
  // Read directory entries
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  // Filter out hidden files/folders (starting with .)
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));

  // Get folder sizes upfront using du (efficient bulk operation)
  const folderSizes = await getFolderSizes(absolutePath);

  // Build file items
  const items = await Promise.all(
    visibleEntries.map(async (entry) => {
      const entryPath = path.join(absolutePath, entry.name);
      let stats;
      try {
        stats = await fs.stat(entryPath);
      } catch {
        // Skip entries we can't stat
        return null;
      }

      const isDirectory = entry.isDirectory();
      const extension = isDirectory
        ? null
        : path.extname(entry.name).slice(1) || null;

      // Use du-calculated size for directories, stat size for files
      const size = isDirectory
        ? (folderSizes.get(entry.name) ?? 0)
        : stats.size;

      return {
        name: entry.name,
        type: isDirectory ? "directory" : "file",
        size,
        modifiedAt: stats.mtime.toISOString(),
        extension,
      } as FileItem;
    }),
  );

  // Filter out nulls and sort: directories first, then alphabetically
  const filteredItems = items.filter((item): item is FileItem => item !== null);

  filteredItems.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return filteredItems;
}
