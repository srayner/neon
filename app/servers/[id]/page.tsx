import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Container,
  Package,
  Clock,
  Globe,
  Terminal,
} from 'lucide-react';

interface ContainerData {
  id: number;
  containerId: string;
  name: string;
  image: string;
  status: 'running' | 'exited' | 'paused' | 'restarting';
  health: string | null;
  ports: string;
}

interface ServerData {
  id: number;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  status: 'online' | 'offline' | 'maintenance';
  cpuCores: number | null;
  totalMemoryGb: number | undefined;
  totalDiskGb: number | undefined;
  cpu: number | undefined;
  memory: number | undefined;
  disk: number | undefined;
  lastMetricsAt: string | null;
  createdAt: string;
  containers: ContainerData[];
}

async function getServer(id: string): Promise<ServerData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/servers/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch server');
  }

  return res.json();
}

// Fake OS data (hardcoded for now)
const osInfo = {
  name: 'Ubuntu',
  version: '22.04.3 LTS',
  codename: 'Jammy Jellyfish',
  kernel: '5.15.0-91-generic',
  arch: 'x86_64',
};

// Fake applications data
const fakeApplications = [
  {
    id: 1,
    name: 'Web Application',
    version: '2.4.1',
    status: 'running',
    containers: ['web-app', 'nginx-proxy'],
  },
  {
    id: 2,
    name: 'API Service',
    version: '1.8.0',
    status: 'running',
    containers: ['api-server', 'redis-cache', 'postgres-db'],
  },
  {
    id: 3,
    name: 'Background Workers',
    version: '1.2.3',
    status: 'running',
    containers: ['worker-1', 'worker-2', 'rabbitmq'],
  },
];

const statusConfig = {
  online: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Online' },
  offline: { dot: 'bg-red-400', text: 'text-red-400', label: 'Offline' },
  maintenance: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Maintenance' },
};

const containerStatusConfig = {
  running: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  exited: { dot: 'bg-red-400', text: 'text-red-400' },
  paused: { dot: 'bg-amber-400', text: 'text-amber-400' },
  restarting: { dot: 'bg-cyan-400', text: 'text-cyan-400' },
};

function MetricGauge({
  label,
  value,
  total,
  unit,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: number | undefined;
  total?: number | string;
  unit: string;
  icon: typeof Cpu;
  gradient: string;
}) {
  const percentage = value ?? 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-zinc-800 p-2">
          <Icon className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-zinc-100">
            {value !== undefined ? `${value.toFixed(1)}${unit}` : '-'}
            {total && <span className="text-sm text-zinc-500 font-normal"> / {total}</span>}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full ${gradient} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ServerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    notFound();
  }

  const status = statusConfig[server.status];

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/servers"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Servers
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
                <Server className="h-7 w-7 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {server.name}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                    <span className={`text-sm ${status.text}`}>{status.label}</span>
                  </span>
                  {server.ipAddress && (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <Globe className="h-3.5 w-3.5" />
                      {server.ipAddress}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OS Section */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-400" />
            Operating System
          </h2>
          <div className="flex items-center gap-6">
            {/* Ubuntu Logo */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#E95420]/10 border border-[#E95420]/30">
              <svg viewBox="0 0 256 256" className="h-12 w-12">
                <circle cx="128" cy="128" r="128" fill="#E95420" />
                <circle cx="128" cy="128" r="113" fill="none" stroke="white" strokeWidth="14" />
                <circle cx="128" cy="37" r="18" fill="white" />
                <circle cx="207" cy="175" r="18" fill="white" />
                <circle cx="49" cy="175" r="18" fill="white" />
                <circle cx="128" cy="128" r="32" fill="white" />
              </svg>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Distribution</p>
                <p className="text-sm font-medium text-zinc-100 mt-1">{osInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Version</p>
                <p className="text-sm font-medium text-zinc-100 mt-1">{osInfo.version}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Kernel</p>
                <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">{osInfo.kernel}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Architecture</p>
                <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">{osInfo.arch}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            System Metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricGauge
              label="CPU Usage"
              value={server.cpu}
              total={server.cpuCores ? `${server.cpuCores} cores` : undefined}
              unit="%"
              icon={Cpu}
              gradient="bg-gradient-to-r from-cyan-500 to-purple-500"
            />
            <MetricGauge
              label="Memory Usage"
              value={server.memory}
              total={server.totalMemoryGb ? `${server.totalMemoryGb.toFixed(0)} GB` : undefined}
              unit="%"
              icon={MemoryStick}
              gradient="bg-gradient-to-r from-purple-500 to-pink-500"
            />
            <MetricGauge
              label="Disk Usage"
              value={server.disk}
              total={server.totalDiskGb ? `${server.totalDiskGb.toFixed(0)} GB` : undefined}
              unit="%"
              icon={HardDrive}
              gradient="bg-gradient-to-r from-emerald-500 to-cyan-500"
            />
          </div>
          {server.lastMetricsAt && (
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(server.lastMetricsAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Containers Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Container className="h-5 w-5 text-pink-400" />
              Containers
              <span className="ml-2 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                {server.containers.length}
              </span>
            </h2>
            <Link
              href={`/docker/containers?serverId=${server.id}`}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          {server.containers.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Container className="mx-auto h-10 w-10 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">No containers running on this server</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Image
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Ports
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {server.containers.slice(0, 5).map((container) => {
                    const containerStatus = containerStatusConfig[container.status];
                    return (
                      <tr key={container.id} className="transition-colors hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-zinc-100">{container.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-zinc-400">{container.image}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${containerStatus.dot}`} />
                            <span className={`text-sm ${containerStatus.text}`}>{container.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-zinc-400">
                            {container.ports || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {server.containers.length > 5 && (
                <div className="border-t border-zinc-800 px-4 py-3 text-center">
                  <Link
                    href={`/docker/containers?serverId=${server.id}`}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View all {server.containers.length} containers →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applications Section */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Applications
            <span className="ml-2 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              {fakeApplications.length}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fakeApplications.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-zinc-100">{app.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">v{app.version}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {app.status}
                  </span>
                </div>
                <div className="border-t border-zinc-800 pt-3 mt-3">
                  <p className="text-xs text-zinc-500 mb-2">Containers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {app.containers.map((containerName) => (
                      <span
                        key={containerName}
                        className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                      >
                        <Container className="h-3 w-3" />
                        {containerName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
