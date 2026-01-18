import { redirect } from 'next/navigation';
import { ContainersTable } from './components/ContainersTable';
import { ServerSelector } from './components/ServerSelector';
import { Container } from './types';

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

async function getContainers(serverId: number): Promise<Container[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/containers?serverId=${serverId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch containers');
  }

  return res.json();
}

interface PageProps {
  searchParams: Promise<{ serverId?: string }>;
}

export default async function ContainersPage({ searchParams }: PageProps) {
  const servers = await getServers();

  if (servers.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Docker Containers
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
    redirect(`/containers?serverId=${servers[0].id}`);
  }

  serverId = parseInt(serverIdParam, 10);

  if (isNaN(serverId) || !servers.some((s) => s.id === serverId)) {
    redirect(`/containers?serverId=${servers[0].id}`);
  }

  const selectedServer = servers.find((s) => s.id === serverId)!;
  const containers = await getContainers(serverId);

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Docker Containers
            </h1>
            <p className="text-zinc-400">
              Showing containers on {selectedServer.name}
            </p>
          </div>
          <ServerSelector servers={servers} selectedServerId={serverId} />
        </div>

        <ContainersTable containers={containers} />
      </div>
    </div>
  );
}