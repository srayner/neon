'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TimeRange, MetricsHistoryResponse, MetricDataPoint } from '../types';
import { TimeRangeSelector } from './TimeRangeSelector';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
}

interface MetricsChartsProps {
  serverId: number;
}

const CHART_COLORS = {
  cpu: '#06b6d4',     // cyan-500
  memory: '#a855f7',  // purple-500
  disk: '#10b981',    // emerald-500
};

const CHART_CONFIG = {
  gridColor: '#27272a',     // zinc-800
  axisColor: '#71717a',     // zinc-500
  tooltipBg: '#18181b',     // zinc-900
  tooltipBorder: '#3f3f46', // zinc-700
};

function formatTimestamp(timestamp: string, range: TimeRange): string {
  const date = new Date(timestamp);
  if (range === '1h' || range === '6h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const date = new Date(label || '');
  const formattedDate = date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        backgroundColor: CHART_CONFIG.tooltipBg,
        borderColor: CHART_CONFIG.tooltipBorder,
      }}
    >
      <p className="mb-1 text-xs text-zinc-400">{formattedDate}</p>
      {payload.map((entry, index) => (
        <p key={entry.name || index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

interface SingleChartProps {
  data: MetricDataPoint[];
  dataKey: keyof Omit<MetricDataPoint, 'timestamp'>;
  color: string;
  title: string;
  range: TimeRange;
}

function SingleChart({ data, dataKey, color, title, range }: SingleChartProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-300">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_CONFIG.gridColor} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => formatTimestamp(value, range)}
              stroke={CHART_CONFIG.axisColor}
              tick={{ fill: CHART_CONFIG.axisColor, fontSize: 12 }}
              tickLine={{ stroke: CHART_CONFIG.axisColor }}
            />
            <YAxis
              domain={[0, 100]}
              stroke={CHART_CONFIG.axisColor}
              tick={{ fill: CHART_CONFIG.axisColor, fontSize: 12 }}
              tickLine={{ stroke: CHART_CONFIG.axisColor }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MetricsCharts({ serverId }: MetricsChartsProps) {
  const [range, setRange] = useState<TimeRange>('7d');
  const [data, setData] = useState<MetricsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/servers/${serverId}/metrics/history?range=${range}`);
        if (!res.ok) {
          throw new Error('Failed to fetch metrics');
        }
        const json: MetricsHistoryResponse = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [serverId, range]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <TimeRangeSelector selectedRange={range} onRangeChange={setRange} />
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
          <p className="text-zinc-400">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <TimeRangeSelector selectedRange={range} onRangeChange={setRange} />
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.dataPoints.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <TimeRangeSelector selectedRange={range} onRangeChange={setRange} />
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
          <p className="text-zinc-400">No data available for the selected time range</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <TimeRangeSelector selectedRange={range} onRangeChange={setRange} />
      </div>

      <SingleChart
        data={data.dataPoints}
        dataKey="cpuPercent"
        color={CHART_COLORS.cpu}
        title="CPU Usage"
        range={range}
      />

      <SingleChart
        data={data.dataPoints}
        dataKey="memoryPercent"
        color={CHART_COLORS.memory}
        title="Memory Usage"
        range={range}
      />

      <SingleChart
        data={data.dataPoints}
        dataKey="diskPercent"
        color={CHART_COLORS.disk}
        title="Disk Usage"
        range={range}
      />
    </div>
  );
}
