'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  Container,
  Package,
  Activity,
  Settings
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Servers', href: '/servers', icon: Server },
  { name: 'Containers', href: '/docker/containers', icon: Container },
  { name: 'Applications', href: '/applications', icon: Package },
  { name: 'Metrics', href: '/metrics', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          NEON
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }
              `}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-sm text-zinc-400">All systems online</span>
        </div>
      </div>
    </div>
  );
}
