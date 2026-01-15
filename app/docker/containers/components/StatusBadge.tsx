import { ContainerStatus } from '../types';

interface StatusBadgeProps {
  status: ContainerStatus;
}

const statusConfig = {
  running: {
    label: 'Running',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  exited: {
    label: 'Exited',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  restarting: {
    label: 'Restarting',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
