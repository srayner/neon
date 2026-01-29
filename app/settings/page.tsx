import { Info } from "lucide-react";

async function getSettings() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/settings`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">
            Settings
          </h1>
          <p className="text-zinc-400">View system configuration settings</p>
        </div>

        {/* Info Card */}
        <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
          <div className="text-sm text-zinc-400">
            <p>
              These settings are configured via environment variables and are
              read-only. They cannot be changed from this interface. Contact
              your system administrator to modify these values.
            </p>
          </div>
        </div>

        {/* Settings Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">
            Configuration
          </h2>

          <div className="space-y-4">
            {/* Backup Directory Setting */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">
                Backup Directory
              </label>
              {settings.backupRoot ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800 px-4 py-2.5">
                  <code className="font-mono text-sm text-zinc-100">
                    {settings.backupRoot}
                  </code>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2.5">
                  <span className="text-sm text-amber-400">Not configured</span>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                The root directory where backup files are stored. Set via the
                BACKUP_ROOT environment variable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
