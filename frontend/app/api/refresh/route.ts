import { NextResponse } from "next/server";
import { reportRedisFailure } from "@/lib/server/redis";
import {
  RefreshNotConfiguredError,
  requestRefresh,
  WorkflowDispatchError,
} from "@/lib/server/refresh";

/**
 * POST /api/refresh: asks GitHub Actions to run the news pipeline now.
 * Public, so it's rate limited by a shared cooldown in Redis. The new
 * ranking lands in Redis a couple of minutes later; the client polls
 * /api/news/top until generatedAt moves past requestedAt.
 */
export async function POST() {
  try {
    const result = await requestRefresh();
    return NextResponse.json(result, {
      status: result.status === "started" ? 202 : 429,
      headers:
        result.status === "cooldown" ? { "Retry-After": String(result.retryAfterSeconds) } : {},
    });
  } catch (error) {
    if (error instanceof RefreshNotConfiguredError) {
      console.error(`[api/refresh] ${error.message}`);
      return NextResponse.json({ message: "Refresh is not configured" }, { status: 503 });
    }

    if (error instanceof WorkflowDispatchError) {
      // 401/403: bad or under-scoped token; 404: wrong repo/workflow name or no access.
      console.error(`[api/refresh] ${error.message}`);
      return NextResponse.json({ message: "Could not start the refresh" }, { status: 502 });
    }

    return NextResponse.json(
      { message: "Refresh unavailable", reason: reportRedisFailure("api/refresh", error) },
      { status: 503 },
    );
  }
}
