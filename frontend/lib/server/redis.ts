import "server-only";
import Redis from "ioredis";
import type { TopStoriesSnapshot } from "@/types/api";

/** Written by the backend pipeline (TrendStoreService.setTopStories). */
const TOP_STORIES_KEY = "music:top";

let client: Redis | undefined;

/** One connection per server instance, reused across requests. */
export function redis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }

  client ??= new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  return client;
}

export async function readSnapshot(): Promise<TopStoriesSnapshot> {
  const value = await redis().get(TOP_STORIES_KEY);
  return value
    ? (JSON.parse(value) as TopStoriesSnapshot)
    : { generatedAt: null, stories: [] };
}
