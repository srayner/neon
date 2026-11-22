import { NextResponse } from "next/server";
import { sendNtfyAlert } from "@/lib/alerts/ntfy";

export async function POST() {
  const sentAt = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "long", // includes the time zone, since the server may run in UTC
  });

  const result = await sendNtfyAlert(
    "Neon test alert",
    `Test alert sent from Neon at ${sentAt}.`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentAt });
}
