import { apiFetch } from "@/lib/api";
import type { Region, TopStoriesSnapshot } from "@/types/api";

/** GET /api/news/top, optionally filtered by region (ranks are per view). */
export function fetchTop(region?: Region): Promise<TopStoriesSnapshot> {
  const query = region ? `?region=${region.toLowerCase()}` : "";
  return apiFetch<TopStoriesSnapshot>(`api/news/top${query}`, { cache: "no-store" });
}
