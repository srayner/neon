import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, extractBearerToken } from "@/lib/auth/jwt";
import { recordDockerGaps } from "@/lib/agent/facts";
import type { ApiResponse, DockerGapsReportRequest } from "@neon/shared";

/**
 * Gaps in an agent's view of Docker (from when to when). The agent resends a
 * gap until this returns success, so a gap already recorded is accepted again
 * without a second entry, and an invalid one is accepted and skipped (see
 * recordDockerGaps).
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing authorization token" },
        { status: 401 },
      );
    }

    const payload = await verifyAgentToken(token);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const body: Partial<DockerGapsReportRequest> = await request.json().catch(() => ({}));
    if (!Array.isArray(body.gaps)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing gaps array" },
        { status: 400 },
      );
    }

    const { created, invalid } = await recordDockerGaps(payload.serverId, body.gaps);
    console.log(
      `[Agent Docker Gaps] ${created} new of ${body.gaps.length} gap(s) from ${payload.serverName}`,
    );
    if (invalid > 0) {
      console.warn(`[Agent Docker Gaps] Skipped ${invalid} invalid gap(s) from ${payload.serverName}`);
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error("[Agent Docker Gaps] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to record Docker gaps" },
      { status: 500 },
    );
  }
}
