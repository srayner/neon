import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  validateAndResolvePath,
  pathExists,
  getBackupRoot,
} from '@/lib/backups/path-utils';

export async function GET(request: NextRequest) {
  try {
    // Check if BACKUP_ROOT is configured
    try {
      getBackupRoot();
    } catch {
      return NextResponse.json(
        { error: 'Backup directory not configured' },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get('path');

    if (!requestedPath) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Validate and resolve the path
    let absolutePath: string;
    try {
      absolutePath = validateAndResolvePath(requestedPath);
    } catch {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Check if path exists and is a file
    const pathInfo = await pathExists(absolutePath);
    if (!pathInfo.exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    if (!pathInfo.isFile) {
      return NextResponse.json(
        { error: 'Path is not a file' },
        { status: 400 }
      );
    }

    // Get file stats for content-length
    const stats = fs.statSync(absolutePath);
    const filename = path.basename(absolutePath);

    // Create readable stream
    const fileStream = fs.createReadStream(absolutePath);

    // Convert Node.js ReadableStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (error) => {
          controller.error(error);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    // Return file as download
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
