"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

interface DeleteServerButtonProps {
  serverId: number;
  serverName: string;
}

export function DeleteServerButton({
  serverId,
  serverName,
}: DeleteServerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete server");
      }

      router.push("/servers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete server");
      setIsPending(false);
    }
  };

  const handleCancel = () => {
    if (isPending) return;
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-red-700/50 bg-red-900/20 px-3.5 py-2 text-sm font-medium text-red-400 transition-colors hover:border-red-600 hover:bg-red-900/40 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
        Delete Server
      </button>

      <ConfirmDialog
        open={open}
        title="Delete server"
        message={`Are you sure you want to delete "${serverName}"? This will also remove all of its containers, services, and metrics history. This cannot be undone.`}
        confirmLabel="Delete"
        isDangerous
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
