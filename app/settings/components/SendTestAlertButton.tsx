"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

interface SendTestAlertButtonProps {
  disabled: boolean;
}

export function SendTestAlertButton({ disabled }: SendTestAlertButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await fetch("/api/alerts/test", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `Failed to send (HTTP ${res.status}).`);
      }
      setSuccess(`Test alert sent at ${body.sentAt}. Check your phone.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test alert.");
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = () => {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-md border border-cyan-700/50 bg-cyan-900/20 px-3.5 py-2 text-sm font-medium text-cyan-300 transition-colors hover:border-cyan-600 hover:bg-cyan-900/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-cyan-700/50 disabled:hover:bg-cyan-900/20 disabled:hover:text-cyan-300"
      >
        <BellRing className="h-4 w-4" />
        Send test alert
      </button>

      <ConfirmDialog
        open={open}
        title="Send test alert"
        message="Send a test push notification to the ntfy topic now?"
        confirmLabel="Send"
        isPending={isPending}
        error={error}
        success={success}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
