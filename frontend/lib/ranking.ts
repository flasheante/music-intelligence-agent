import type { Region, TopStory } from "@/types/api";

export const REGIONS: Region[] = ["ARGENTINA", "USA", "EUROPE", "GLOBAL"];

export const GENRES = [
  "ROCK",
  "ALTERNATIVE",
  "INDIE",
  "METAL",
  "PUNK",
  "POP",
  "HIP_HOP",
  "ELECTRONIC",
  "PROG",
  "POST_PUNK",
  "LATIN",
  "OTHER",
] as const;

/** "argentina" → "ARGENTINA", "hip-hop" → "HIP_HOP"; undefined if unknown. */
export function parseFilter<T extends string>(
  allowed: readonly T[],
  raw: string | null,
): T | undefined | "invalid" {
  if (!raw) return undefined;
  const value = raw.toUpperCase().replace(/[- ]/g, "_");
  return (allowed as readonly string[]).includes(value) ? (value as T) : "invalid";
}

/**
 * Same rule as the backend's filterStories (src/trends/ranking.ts): filter
 * the global candidates, then re-number ranks within the view.
 */
export function filterStories(
  stories: TopStory[],
  { region, genre }: { region?: string; genre?: string },
  limit: number,
): TopStory[] {
  return stories
    .filter((story) => !region || story.regions.includes(region as Region))
    .filter((story) => !genre || story.genres.includes(genre))
    .slice(0, limit)
    .map((story, index) => ({ ...story, rank: index + 1 }));
}
