"use client";

import { formatTimestamp } from "@/lib/time/format";
import { useTimeZoneMode } from "./TimeZoneToggle";

interface ActivityTimeProps {
  /** ISO timestamp (UTC). */
  at: string;
  /** e.g. "5 minutes ago". */
  relative: string;
}

export function ActivityTime({ at, relative }: ActivityTimeProps) {
  const mode = useTimeZoneMode();
  return (
    <p className="mt-1 text-xs text-zinc-500">
      <time dateTime={at}>{formatTimestamp(new Date(at), mode)}</time> · {relative}
    </p>
  );
}
