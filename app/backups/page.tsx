import { FileBrowser } from './components/FileBrowser';

export default function BackupsPage() {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Backups
          </h1>
          <p className="text-zinc-400">
            Browse and download backup files
          </p>
        </div>

        <FileBrowser />
      </div>
    </div>
  );
}
