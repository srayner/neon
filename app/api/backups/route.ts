import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import {
  validateAndResolvePath,
  pathExists,
  getRelativePath,
  getParentPath,
  getBackupRoot,
  getNormalizedBackupRoot,
} from "@/lib/backups/path-utils";
import { listDirectory } from "@/lib/backups/directory";
import { DirectoryListing } from "@/app/backups/types";

export async function GET(request: NextRequest) {
  try {
    // Check if BACKUP_ROOT is configured
    try {
      getBackupRoot();
    } catch {
      return NextResponse.json(
        { error: "Backup directory not configured" },
        { status: 503 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get("path") || "";

    // Validate and resolve the path
    let absolutePath: string;
    try {
      absolutePath = validateAndResolvePath(requestedPath);
    } catch {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if path exists and is a directory
    const pathInfo = await pathExists(absolutePath);
    if (!pathInfo.exists) {
      return NextResponse.json({ error: "Path not found" }, { status: 404 });
    }

    if (!pathInfo.isDirectory) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 },
      );
    }

    // List directory contents with folder sizes
    const items = await listDirectory(absolutePath);

    const relativePath = getRelativePath(absolutePath);
    const currentPath = relativePath === "." ? "" : relativePath;

    const response: DirectoryListing = {
      path: currentPath,
      parentPath: getParentPath(relativePath),
      items,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error listing directory:", error);
    return NextResponse.json(
      { error: "Failed to list directory" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if BACKUP_ROOT is configured
    try {
      getBackupRoot();
    } catch {
      return NextResponse.json(
        { error: "Backup directory not configured" },
        { status: 503 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get("path");

    // Require path parameter
    if (!requestedPath) {
      return NextResponse.json(
        { error: "Path parameter required" },
        { status: 400 },
      );
    }

    // Validate and resolve the path
    let absolutePath: string;
    try {
      absolutePath = validateAndResolvePath(requestedPath);
    } catch {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Prevent deletion of BACKUP_ROOT itself
    const normalizedBackupRoot = getNormalizedBackupRoot();
    if (absolutePath === normalizedBackupRoot) {
      return NextResponse.json(
        { error: "Cannot delete backup root directory" },
        { status: 400 },
      );
    }

    // Check if path exists
    const pathInfo = await pathExists(absolutePath);
    if (!pathInfo.exists) {
      return NextResponse.json({ error: "Path not found" }, { status: 404 });
    }

    // Delete file or directory
    if (pathInfo.isDirectory) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting path:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
