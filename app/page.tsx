import { Server, Container, Activity, AlertTriangle } from 'lucide-react';
import { StatCard } from './components/StatCard';
import { ServerStatusCard } from './components/ServerStatusCard';

type ServerHealth = 'healthy' | 'warning' | 'critical';

interface ServerData {
  id: number;
  name: string;
  containerCount: number;
  cpu?: number;
  memory?: number;
  disk?: number;
}

interface Stats {
  totalServers: number;
  totalContainers: number;
  avgCpu: number;
  activeAlerts: number;
}

async function getStats(): Promise<Stats> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function getServers(): Promise<ServerData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/servers`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch servers');
  return res.json();
}

interface ActivityData {
  id: number;
  type: 'warning' | 'critical' | 'success' | 'info';
  message: string;
  time: string;
}

async function getRecentActivities(): Promise<ActivityData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/activities?limit=5`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

function getServerHealth(cpu?: number, memory?: number): ServerHealth {
  if (!cpu || !memory) return 'healthy';
  if (cpu >= 80 || memory >= 85) return 'critical';
  if (cpu >= 60 || memory >= 70) return 'warning';
  return 'healthy';
}

const activityColors = {
  warning: 'border-l-amber-400 bg-amber-500/5',
  critical: 'border-l-red-400 bg-red-500/5',
  success: 'border-l-emerald-400 bg-emerald-500/5',
  info: 'border-l-cyan-400 bg-cyan-500/5',
};

export default async function Dashboard() {
  const [stats, servers, activities] = await Promise.all([
    getStats(),
    getServers(),
    getRecentActivities(),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-zinc-400">
            Welcome back! Here's what's happening with your infrastructure.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Servers"
            value={stats.totalServers}
            icon={Server}
            href="/servers"
            color="cyan"
          />
          <StatCard
            title="Containers"
            value={stats.totalContainers}
            icon={Container}
            color="purple"
          />
          <StatCard
            title="Avg CPU Usage"
            value={`${stats.avgCpu}%`}
            icon={Activity}
            color="pink"
          />
          <StatCard
            title="Active Alerts"
            value={stats.activeAlerts}
            icon={AlertTriangle}
            color="emerald"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Server Status - 2 columns */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-50">Server Status</h2>
              <a
                href="/servers"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View all →
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {servers.map((server) => (
                <ServerStatusCard
                  key={server.id}
                  id={server.id}
                  name={server.name}
                  status={getServerHealth(server.cpu, server.memory)}
                  containerCount={server.containerCount}
                  cpu={server.cpu}
                  memory={server.memory}
                  disk={server.disk}
                />
              ))}
            </div>
          </div>

          {/* Recent Activity - 1 column */}
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-50">Recent Activity</h2>
            </div>
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              {activities.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">No recent activity</p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`border-l-2 pl-3 py-2 ${activityColors[activity.type]}`}
                  >
                    <p className="text-sm text-zinc-200">{activity.message}</p>
                    <p className="mt-1 text-xs text-zinc-500">{activity.time}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-6">
          <h2 className="mb-4 text-xl font-semibold text-zinc-50">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button className="rounded-lg border border-cyan-500/30 bg-zinc-900/50 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition-all hover:border-cyan-500/50 hover:bg-zinc-900 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              Deploy Application
            </button>
            <button className="rounded-lg border border-purple-500/30 bg-zinc-900/50 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition-all hover:border-purple-500/50 hover:bg-zinc-900 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              View Metrics
            </button>
            <button className="rounded-lg border border-pink-500/30 bg-zinc-900/50 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition-all hover:border-pink-500/50 hover:bg-zinc-900 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              Manage Containers
            </button>
            <button className="rounded-lg border border-emerald-500/30 bg-zinc-900/50 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition-all hover:border-emerald-500/50 hover:bg-zinc-900 hover:shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              Server Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
