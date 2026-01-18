import Link from 'next/link';
import { Server, Container, Cpu, MemoryStick, HardDrive } from 'lucide-react';

interface ServerData {
  id: number;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  status: 'online' | 'offline' | 'maintenance';
  containerCount: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  cpuCores?: number;
  totalMemoryGb?: number;
  totalDiskGb?: number;
  lastMetricsAt: string | null;
}

async function getServers(): Promise<ServerData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/servers`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch servers');
  }

  return res.json();
}

const statusConfig = {
  online: {
    label: 'Online',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-red-400',
    text: 'text-red-400',
  },
  maintenance: {
    label: 'Maintenance',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
  },
};

function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function ServersPage() {
  const servers = await getServers();

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Servers
          </h1>
          <p className="text-zinc-400">
            Manage and monitor all your servers
          </p>
        </div>

        {servers.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <Server className="mx-auto h-12 w-12 text-zinc-600" />
            <h3 className="mt-4 text-lg font-medium text-zinc-300">No servers configured</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Connect an agent to start monitoring your servers.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Server
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Containers
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" />
                        CPU
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <span className="flex items-center gap-1">
                        <MemoryStick className="h-3.5 w-3.5" />
                        Memory
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5" />
                        Disk
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Last Seen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {servers.map((server) => {
                    const status = statusConfig[server.status];
                    return (
                      <tr
                        key={server.id}
                        className="transition-colors hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-4">
                          <Link href={`/servers/${server.id}`} className="flex items-center gap-3 group">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                              <Server className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                              <div className="font-medium text-zinc-100 group-hover:text-cyan-400 transition-colors">{server.name}</div>
                              <div className="text-sm text-zinc-500">
                                {server.ipAddress || server.hostname || 'No address'}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                            <span className={`text-sm ${status.text}`}>{status.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/containers?serverId=${server.id}`}
                            className="inline-flex items-center gap-1.5 text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                          >
                            <Container className="h-4 w-4" />
                            {server.containerCount}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          {server.cpu !== undefined ? (
                            <div className="space-y-1">
                              <span className="text-sm font-mono text-zinc-100">{server.cpu.toFixed(1)}%</span>
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                                  style={{ width: `${Math.min(server.cpu, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {server.memory !== undefined ? (
                            <div className="space-y-1">
                              <span className="text-sm font-mono text-zinc-100">{server.memory.toFixed(1)}%</span>
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                  style={{ width: `${Math.min(server.memory, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {server.disk !== undefined ? (
                            <div className="space-y-1">
                              <span className="text-sm font-mono text-zinc-100">{server.disk.toFixed(1)}%</span>
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                                  style={{ width: `${Math.min(server.disk, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-zinc-400">
                            {formatLastSeen(server.lastMetricsAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
