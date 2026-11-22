import { redirect } from 'next/navigation';
import { listServers } from '@/lib/data/servers';
import { listContainers } from '@/lib/data/containers';
import { ContainersTable } from './components/ContainersTable';
import { ServerSelector } from './components/ServerSelector';
import { Container, ContainerHealth } from './types';

interface PageProps {
  searchParams: Promise<{ serverId?: string }>;
}

export default async function ContainersPage({ searchParams }: PageProps) {
  const servers = await listServers();

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

  if (!serverIdParam) {
    redirect(`/containers?serverId=${servers[0].id}`);
  }

  const serverId = parseInt(serverIdParam, 10);

  if (isNaN(serverId) || !servers.some((s) => s.id === serverId)) {
    redirect(`/containers?serverId=${servers[0].id}`);
  }

  const selectedServer = servers.find((s) => s.id === serverId)!;
  // Only the fields the table shows. The agent writes health and labels;
  // the database types them as a plain string and JSON.
  const containers: Container[] = (await listContainers(serverId)).map((c) => ({
    id: c.id,
    containerId: c.containerId,
    name: c.name,
    image: c.image,
    status: c.status,
    health: c.health as ContainerHealth,
    ports: c.ports,
    exitCode: c.exitCode,
    startedAt: c.startedAt,
    labels: c.labels as Record<string, string>,
    networks: c.networks,
  }));

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