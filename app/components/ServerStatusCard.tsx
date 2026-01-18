import Link from 'next/link';
import { Server, Cpu, HardDrive, MemoryStick } from 'lucide-react';

type ServerHealth = 'healthy' | 'warning' | 'critical';

interface ServerStatusCardProps {
  id: number;
  name: string;
  status: ServerHealth;
  containerCount: number;
  cpu?: number;
  memory?: number;
  disk?: number;
}

const healthConfig = {
  healthy: {
    color: 'emerald',
    glow: 'shadow-[0_0_15px_rgba(52,211,153,0.4)]',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  warning: {
    color: 'amber',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.4)]',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  critical: {
    color: 'red',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
  },
};

export function ServerStatusCard({
  id,
  name,
  status,
  containerCount,
  cpu,
  memory,
  disk,
}: ServerStatusCardProps) {
  const health = healthConfig[status];

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border bg-zinc-900/50 p-5 transition-all hover:scale-[1.02]
        ${health.border} ${health.glow}
      `}
    >
      {/* Status indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${health.dot} shadow-[0_0_8px_currentColor]`} />
          <h3 className="text-lg font-semibold text-zinc-50">{name}</h3>
        </div>
        <Server className="h-5 w-5 text-zinc-500" />
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-zinc-400">
            <Server className="h-4 w-4" />
            Containers
          </span>
          <Link
            href={`/docker/containers?serverId=${id}`}
            className="font-mono text-zinc-100 hover:text-cyan-400 transition-colors"
          >
            {containerCount}
          </Link>
        </div>

        {cpu !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-400">
                <Cpu className="h-4 w-4" />
                CPU
              </span>
              <span className="font-mono text-zinc-100">{cpu}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all`}
                style={{ width: `${cpu}%` }}
              />
            </div>
          </div>
        )}

        {memory !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-400">
                <MemoryStick className="h-4 w-4" />
                Memory
              </span>
              <span className="font-mono text-zinc-100">{memory}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all`}
                style={{ width: `${memory}%` }}
              />
            </div>
          </div>
        )}

        {disk !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-400">
                <HardDrive className="h-4 w-4" />
                Disk
              </span>
              <span className="font-mono text-zinc-100">{disk}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all`}
                style={{ width: `${disk}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
