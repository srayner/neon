import { Container } from '../types';
import { StatusBadge } from './StatusBadge';
import { HealthBadge } from './HealthBadge';

interface ContainersTableProps {
  containers: Container[];
}

export function ContainersTable({ containers }: ContainersTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Container ID
              </th>
              <th className="w-48 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Name
              </th>
              <th className="w-64 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Image
              </th>
              <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Status
              </th>
              <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Health
              </th>
              <th className="w-40 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Ports
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {containers.map((container) => (
              <tr
                key={container.id}
                className="transition-colors hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3.5 text-sm font-mono text-zinc-300 truncate" title={container.containerId}>
                  {container.containerId.slice(0, 12)}
                </td>
                <td className="px-4 py-3.5 text-sm font-medium text-zinc-100 truncate" title={container.name}>
                  {container.name}
                </td>
                <td className="px-4 py-3.5 text-sm font-mono text-zinc-400 truncate" title={container.image}>
                  {container.image}
                </td>
                <td className="px-4 py-3.5 text-sm">
                  <StatusBadge status={container.status} />
                </td>
                <td className="px-4 py-3.5 text-sm">
                  <HealthBadge health={container.health} />
                </td>
                <td className="px-4 py-3.5 text-sm font-mono text-zinc-400 truncate" title={container.ports}>
                  {container.ports}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
