import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data/settings";

export async function GET() {
  return NextResponse.json(await getSettings());
}
