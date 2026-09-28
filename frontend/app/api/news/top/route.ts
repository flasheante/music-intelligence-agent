import { type NextRequest, NextResponse } from "next/server";
import { filterStories, GENRES, parseFilter, REGIONS } from "@/lib/ranking";
import { readSnapshot, reportRedisFailure } from "@/lib/server/redis";

const DEFAULT_TOP_NEWS_LIMIT = 10;

/**
 * An empty or non-numeric TOP_NEWS_LIMIT (e.g. a blank Vercel variable)
 * must not turn into 0/NaN and silently empty the ranking.
 */
function topNewsLimit(): number {
  const parsed = Number.parseInt(process.env.TOP_NEWS_LIMIT ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TOP_NEWS_LIMIT;
}

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
      stories: filterStories(snapshot.stories, { region, genre }, topNewsLimit()),
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Ranking unavailable", reason: reportRedisFailure("api/news/top", error) },
      { status: 503 },
    );
  }
}
