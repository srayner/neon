'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

interface Server {
  id: number;
  name: string;
}

interface ServerSelectorProps {
  servers: Server[];
  selectedServerId: number;
}

export function ServerSelector({ servers, selectedServerId }: ServerSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newServerId = e.target.value;
    router.push(`/containers?serverId=${newServerId}`);
  };

  return (
    <div className="relative inline-block">
      <select
        value={selectedServerId}
        onChange={handleChange}
        className="appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pr-10 text-sm text-zinc-100 transition-colors hover:border-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        {servers.map((server) => (
          <option key={server.id} value={server.id}>
            {server.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}
