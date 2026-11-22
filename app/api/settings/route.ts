import { NextResponse } from "next/server";
import { getNtfyPublicSettings } from "@/lib/alerts/ntfy";

export async function GET() {
  return NextResponse.json({
    backupRoot: process.env.BACKUP_ROOT || null,
    ntfy: getNtfyPublicSettings(),
  });
}
