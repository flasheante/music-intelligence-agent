import { NextResponse } from "next/server";
import { readSnapshot, reportRedisFailure } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

/** GET /api/trends: every ranked candidate, not just the Top N. */
export async function GET() {
  try {
    return NextResponse.json(await readSnapshot());
  } catch (error) {
    return NextResponse.json(
      { message: "Ranking unavailable", reason: reportRedisFailure("api/trends", error) },
      { status: 503 },
    );
  }
}
