import { ContainerHealth } from '../types';

interface HealthBadgeProps {
  health: ContainerHealth;
}

const healthConfig = {
  healthy: {
    label: 'Healthy',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  unhealthy: {
    label: 'Unhealthy',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  starting: {
    label: 'Starting',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  none: {
    label: '-',
    className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
} as const;

export function HealthBadge({ health }: HealthBadgeProps) {
  // Return empty if health is null or empty string
  if (!health) {
    return null;
  }

  const config = healthConfig[health];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
