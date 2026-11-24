"use client";

import { useSyncExternalStore } from "react";
import type { TimeZoneMode } from "@/lib/time/format";

// The UTC/Local choice for the activity timeline, remembered in this browser.
const STORAGE_KEY = "neon.timeZone";
const listeners = new Set<() => void>();

// Storage can throw (site data blocked); then the choice isn't remembered.
function read(): TimeZoneMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "local" ? "local" : "utc";
  } catch {
    return "utc";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changing the choice.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(mode: TimeZoneMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

/** UTC on the server and until the browser's saved choice is read. */
export function useTimeZoneMode(): TimeZoneMode {
  return useSyncExternalStore(subscribe, read, () => "utc");
}

export function TimeZoneToggle() {
  const mode = useTimeZoneMode();

  return (
    <div
      role="group"
      aria-label="Show times in"
      className="inline-flex rounded-md border border-zinc-800 bg-zinc-900/50 p-0.5 text-xs"
    >
      {(["utc", "local"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => write(m)}
          aria-pressed={mode === m}
          className={`rounded px-2 py-1 font-medium transition-colors ${
            mode === m
              ? "bg-cyan-900/40 text-cyan-300"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {m === "utc" ? "UTC" : "Local"}
        </button>
      ))}
    </div>
  );
}
