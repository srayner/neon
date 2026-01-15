import { ContainersTable } from './components/ContainersTable';
import { Container } from './types';

async function getContainers(): Promise<Container[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/docker/containers`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch containers');
  }

  return res.json();
}

export default async function ContainersPage() {
  const containers = await getContainers();

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Docker Containers
          </h1>
          <p className="text-zinc-400">
            Manage and monitor your running containers across all servers
          </p>
        </div>

        <ContainersTable containers={containers} />
      </div>
    </div>
  );
}