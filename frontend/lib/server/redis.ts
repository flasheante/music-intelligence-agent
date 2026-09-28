import "server-only";
import Redis from "ioredis";
import type { TopStoriesSnapshot } from "@/types/api";

/** Written by the backend pipeline (TrendStoreService.setTopStories). */
const TOP_STORIES_KEY = "music:top";

export class MissingRedisUrlError extends Error {
  constructor() {
    super("REDIS_URL is not set");
    this.name = "MissingRedisUrlError";
  }
}

let client: Redis | undefined;

/** One connection per server instance, reused across requests. */
export function redis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new MissingRedisUrlError();
  }

  if (!client) {
    client = new Redis(url.trim(), {
      lazyConnect: true,
      // Fail a request within seconds instead of hanging the page: Upstash
      // drops a connection with a wrong password silently, so without these
      // limits ioredis would keep reconnecting until the function times out.
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
    });
    client.on("error", (error: Error) => {
      console.error(`[redis] connection error: ${error.message}`);
    });
  }
  return client;
}

export async function readSnapshot(): Promise<TopStoriesSnapshot> {
  const value = await redis().get(TOP_STORIES_KEY);
  return value
    ? (JSON.parse(value) as TopStoriesSnapshot)
    : { generatedAt: null, stories: [] };
}

/**
 * Logs why Redis failed (visible in Vercel's function logs) and returns a
 * short reason safe to show publicly - never the URL or its password.
 */
export function reportRedisFailure(route: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${route}] Redis read failed: ${message}`);
  return error instanceof MissingRedisUrlError
    ? "REDIS_URL is not configured"
    : "Redis connection failed";
}
