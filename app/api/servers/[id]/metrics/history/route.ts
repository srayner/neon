import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TimeRange, MetricDataPoint, MetricsHistoryResponse } from '@/app/metrics/types';

const TIME_RANGE_CONFIG: Record<TimeRange, { hours: number; useAggregation: boolean }> = {
  '1h': { hours: 1, useAggregation: false },
  '6h': { hours: 6, useAggregation: false },
  '24h': { hours: 24, useAggregation: false },
  '7d': { hours: 168, useAggregation: true },
  '30d': { hours: 720, useAggregation: true },
};

interface AggregatedMetric {
  bucket: Date;
  avg_cpu: string;
  avg_memory: string;
  avg_disk: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverId = parseInt(id, 10);

    if (isNaN(serverId)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get('range') || '7d') as TimeRange;

    if (!TIME_RANGE_CONFIG[range]) {
      return NextResponse.json(
        { error: 'Invalid time range' },
        { status: 400 }
      );
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { id: true, name: true },
    });

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    const config = TIME_RANGE_CONFIG[range];
    const since = new Date(Date.now() - config.hours * 60 * 60 * 1000);

    let dataPoints: MetricDataPoint[];

    if (config.useAggregation) {
      // Use PostgreSQL date_trunc for hourly aggregation
      const aggregatedMetrics = await prisma.$queryRaw<AggregatedMetric[]>`
        SELECT
          date_trunc('hour', timestamp) as bucket,
          AVG(cpu_percent)::numeric(5,2) as avg_cpu,
          AVG(memory_percent)::numeric(5,2) as avg_memory,
          AVG(disk_percent)::numeric(5,2) as avg_disk
        FROM server_metric
        WHERE server_id = ${serverId} AND timestamp >= ${since}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      dataPoints = aggregatedMetrics.map((m) => ({
        timestamp: m.bucket.toISOString(),
        cpuPercent: parseFloat(m.avg_cpu),
        memoryPercent: parseFloat(m.avg_memory),
        diskPercent: parseFloat(m.avg_disk),
      }));
    } else {
      // Use raw data for shorter time ranges
      const metrics = await prisma.serverMetric.findMany({
        where: {
          serverId,
          timestamp: { gte: since },
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          cpuPercent: true,
          memoryPercent: true,
          diskPercent: true,
        },
      });

      dataPoints = metrics.map((m) => ({
        timestamp: m.timestamp.toISOString(),
        cpuPercent: Number(m.cpuPercent),
        memoryPercent: Number(m.memoryPercent),
        diskPercent: Number(m.diskPercent),
      }));
    }

    const response: MetricsHistoryResponse = {
      serverId: server.id,
      serverName: server.name,
      timeRange: range,
      interval: config.useAggregation ? 'hourly' : 'raw',
      dataPoints,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching metrics history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics history' },
      { status: 500 }
    );
  }
}
