import { type NextRequest, NextResponse } from "next/server";
import { filterStories, GENRES, parseFilter, REGIONS } from "@/lib/ranking";
import { readSnapshot, reportRedisFailure } from "@/lib/server/redis";

const TOP_NEWS_LIMIT = Number(process.env.TOP_NEWS_LIMIT ?? 10);

/** GET /api/news/top?region=argentina&genre=rock (spec 27), read-only. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const region = parseFilter(REGIONS, params.get("region"));
  const genre = parseFilter(GENRES, params.get("genre"));

  if (region === "invalid" || genre === "invalid") {
    return NextResponse.json({ message: "Unknown region or genre" }, { status: 400 });
  }

  try {
    const snapshot = await readSnapshot();
    return NextResponse.json({
      generatedAt: snapshot.generatedAt,
      stories: filterStories(snapshot.stories, { region, genre }, TOP_NEWS_LIMIT),
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Ranking unavailable", reason: reportRedisFailure("api/news/top", error) },
      { status: 503 },
    );
  }
}
