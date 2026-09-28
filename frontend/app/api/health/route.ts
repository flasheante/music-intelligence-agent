import { NextResponse } from "next/server";
import { redis } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await redis().ping();
    return NextResponse.json({ status: "ok", redis: "ok" });
  } catch {
    return NextResponse.json({ status: "error", redis: "down" }, { status: 503 });
  }
}
