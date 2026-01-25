import { FileCategory, getFileCategory } from '../types';

interface FileTypeBadgeProps {
  extension: string | null;
  isDirectory?: boolean;
}

const categoryConfig: Record<FileCategory | 'directory', { label: string; className: string }> = {
  directory: {
    label: 'Folder',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  archive: {
    label: 'Archive',
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  database: {
    label: 'Database',
    className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  data: {
    label: 'Data',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  log: {
    label: 'Log',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
  other: {
    label: 'File',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
};

export function FileTypeBadge({ extension, isDirectory }: FileTypeBadgeProps) {
  const category = isDirectory ? 'directory' : getFileCategory(extension);
  const config = categoryConfig[category];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
