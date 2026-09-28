import { NextResponse } from "next/server";
import { redis, reportRedisFailure } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await redis().ping();
    return NextResponse.json({ status: "ok", redis: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", redis: "down", reason: reportRedisFailure("api/health", error) },
      { status: 503 },
    );
  }
}
