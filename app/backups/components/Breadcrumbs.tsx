'use client';

import { Home, ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  const segments = path ? path.split('/').filter(Boolean) : [];

  const handleSegmentClick = (index: number) => {
    const newPath = segments.slice(0, index + 1).join('/');
    onNavigate(newPath);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center justify-center rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        title="Home"
      >
        <Home className="h-4 w-4" />
      </button>

      {segments.map((segment, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-zinc-600" />
          <button
            onClick={() => handleSegmentClick(index)}
            className={`rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-800 ${
              index === segments.length - 1
                ? 'text-cyan-400'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {segment}
          </button>
        </div>
      ))}

      {segments.length === 0 && (
        <span className="ml-1 text-sm text-zinc-400">Root</span>
      )}
    </div>
  );
}
