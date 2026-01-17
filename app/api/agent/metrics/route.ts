import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAgentToken, extractBearerToken } from '@/lib/auth/jwt';
import { Decimal } from '@prisma/client/runtime/library';
import type { MetricsReportRequest, ApiResponse } from '@neon/shared';

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const payload = await verifyAgentToken(token);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { serverId, serverName } = payload;

    // Parse request body
    const body: MetricsReportRequest = await request.json();
    const { metrics } = body;

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing or empty metrics array' },
        { status: 400 }
      );
    }

    console.log(`[Agent Metrics] Receiving ${metrics.length} metric(s) from ${serverName}`);

    // Insert all metrics records
    const metricsData = metrics.map((m) => ({
      serverId,
      timestamp: new Date(m.timestamp),
      cpuPercent: new Decimal(m.cpuPercent.toFixed(2)),
      memoryPercent: new Decimal(m.memoryPercent.toFixed(2)),
      diskPercent: new Decimal(m.diskPercent.toFixed(2)),
      memoryUsedGb: new Decimal(m.memoryUsedGb.toFixed(2)),
      memoryTotalGb: new Decimal(m.memoryTotalGb.toFixed(2)),
      diskUsedGb: new Decimal(m.diskUsedGb.toFixed(2)),
      diskTotalGb: new Decimal(m.diskTotalGb.toFixed(2)),
      networkRxBytes: BigInt(m.networkRxBytes),
      networkTxBytes: BigInt(m.networkTxBytes),
    }));

    await prisma.serverMetric.createMany({
      data: metricsData,
    });

    // Update server's current metrics with the latest values
    const latestMetric = metrics[metrics.length - 1];
    await prisma.server.update({
      where: { id: serverId },
      data: {
        currentCpuPercent: new Decimal(latestMetric.cpuPercent.toFixed(2)),
        currentMemoryPercent: new Decimal(latestMetric.memoryPercent.toFixed(2)),
        currentDiskPercent: new Decimal(latestMetric.diskPercent.toFixed(2)),
        lastMetricsAt: new Date(latestMetric.timestamp),
        status: 'online',
      },
    });

    console.log(`[Agent Metrics] Stored ${metrics.length} metric(s) for ${serverName}`);

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('[Agent Metrics] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to store metrics' },
      { status: 500 }
    );
  }
}
