import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'cyan' | 'purple' | 'pink' | 'emerald';
}

const colorClasses = {
  cyan: {
    gradient: 'from-cyan-500/20 to-cyan-500/5',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    icon: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  purple: {
    gradient: 'from-purple-500/20 to-purple-500/5',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    icon: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  pink: {
    gradient: 'from-pink-500/20 to-pink-500/5',
    glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]',
    icon: 'text-pink-400',
    border: 'border-pink-500/30',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
    icon: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
};

export function StatCard({ title, value, icon: Icon, href, trend, color = 'cyan' }: StatCardProps) {
  const colors = colorClasses[color];

  const content = (
    <div
      className={`
        relative overflow-hidden rounded-xl border bg-gradient-to-br p-6 transition-all hover:scale-[1.02]
        ${colors.border} ${colors.gradient} ${colors.glow}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">{value}</p>
          {trend && (
            <p className={`mt-2 text-sm ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={`rounded-lg bg-zinc-900/50 p-3 ${colors.glow}`}>
          <Icon className={`h-6 w-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
