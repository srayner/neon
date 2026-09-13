"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  isPending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDangerous = false,
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>

        {error && (
          <p className="mt-3 rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              isDangerous
                ? "rounded-md border border-red-700/50 bg-red-900/40 px-3.5 py-2 text-sm font-medium text-red-300 transition-colors hover:border-red-600 hover:bg-red-900/60 hover:text-red-200 disabled:opacity-50"
                : "rounded-md border border-cyan-700/50 bg-cyan-900/40 px-3.5 py-2 text-sm font-medium text-cyan-300 transition-colors hover:border-cyan-600 hover:bg-cyan-900/60 hover:text-cyan-200 disabled:opacity-50"
            }
          >
            {isPending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
