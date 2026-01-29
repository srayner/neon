import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    backupRoot: process.env.BACKUP_ROOT || null,
    // Future settings can be added here
  });
}
