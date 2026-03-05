'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Container } from '../types';
import { StatusBadge } from './StatusBadge';
import { HealthBadge } from './HealthBadge';

interface ContainersTableProps {
  containers: Container[];
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function ExitCodeBadge({ exitCode, status }: { exitCode: number | null; status: string }) {
  if (status !== 'exited' || exitCode === null) {
    return <span className="text-zinc-500">-</span>;
  }

  if (exitCode === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-700/50 px-2 py-0.5 text-xs font-medium text-zinc-300">
        {exitCode}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
      {exitCode}
    </span>
  );
}

export function ContainersTable({ containers }: ContainersTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="w-10 px-2 py-3"></th>
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
              <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Exit
              </th>
              <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Health
              </th>
              <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Started
              </th>
              <th className="w-40 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Ports
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {containers.map((container) => {
              const isExpanded = expandedRows.has(container.id);
              const hasDetails =
                (container.labels && Object.keys(container.labels).length > 0) ||
                (container.networks && container.networks.length > 0);

              return (
                <>
                  <tr
                    key={container.id}
                    className="transition-colors hover:bg-zinc-800/50"
                  >
                    <td className="px-2 py-3.5">
                      {hasDetails && (
                        <button
                          onClick={() => toggleRow(container.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </td>
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
                      <ExitCodeBadge exitCode={container.exitCode} status={container.status} />
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <HealthBadge health={container.health} />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-zinc-400" title={container.startedAt || undefined}>
                      {formatRelativeTime(container.startedAt)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono text-zinc-400 truncate" title={container.ports}>
                      {container.ports}
                    </td>
                  </tr>
                  {isExpanded && hasDetails && (
                    <tr key={`${container.id}-details`} className="bg-zinc-900/30">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-8 space-y-3">
                          {/* Full Container ID */}
                          <div>
                            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Full Container ID</span>
                            <p className="mt-1 text-sm font-mono text-zinc-300">{container.containerId}</p>
                          </div>

                          {/* Networks */}
                          {container.networks && container.networks.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Networks</span>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {container.networks.map((network) => (
                                  <span
                                    key={network}
                                    className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400"
                                  >
                                    {network}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Labels */}
                          {container.labels && Object.keys(container.labels).length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Labels</span>
                              <div className="mt-1 max-h-32 overflow-y-auto rounded bg-zinc-800/50 p-2">
                                <dl className="space-y-1">
                                  {Object.entries(container.labels).map(([key, value]) => (
                                    <div key={key} className="flex text-xs">
                                      <dt className="font-mono text-purple-400 mr-2 shrink-0">{key}:</dt>
                                      <dd className="font-mono text-zinc-400 truncate" title={value}>{value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
