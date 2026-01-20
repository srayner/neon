import { redirect } from 'next/navigation';
import { ServerMetricsSelector } from './components/ServerMetricsSelector';
import { MetricsCharts } from './components/MetricsCharts';

interface Server {
  id: number;
  name: string;
}

async function getServers(): Promise<Server[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/servers`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch servers');
  }

  return res.json();
}

interface PageProps {
  searchParams: Promise<{ serverId?: string }>;
}

export default async function MetricsPage({ searchParams }: PageProps) {
  const servers = await getServers();

  if (servers.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Server Metrics
            </h1>
            <p className="text-zinc-400">No servers configured</p>
          </div>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const serverIdParam = params.serverId;
  let serverId: number;

  if (!serverIdParam) {
    redirect(`/metrics?serverId=${servers[0].id}`);
  }

  serverId = parseInt(serverIdParam, 10);

  if (isNaN(serverId) || !servers.some((s) => s.id === serverId)) {
    redirect(`/metrics?serverId=${servers[0].id}`);
  }

  const selectedServer = servers.find((s) => s.id === serverId)!;

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Server Metrics
            </h1>
            <p className="text-zinc-400">
              Historical metrics for {selectedServer.name}
            </p>
          </div>
          <ServerMetricsSelector servers={servers} selectedServerId={serverId} />
        </div>

        <MetricsCharts serverId={serverId} />
      </div>
    </div>
  );
}
