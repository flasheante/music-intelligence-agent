import { ApiError, apiUrl } from "@/lib/api";
import type { RefreshResponse } from "@/types/api";

/**
 * POST /api/refresh. Both 202 (started) and 429 (cooling down) are normal
 * answers the UI shows, so only other statuses throw.
 */
export async function requestRefresh(): Promise<RefreshResponse> {
  let response: Response;

  try {
    response = await fetch(apiUrl("api/refresh"), {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error", 0);
  }

  if (response.status !== 202 && response.status !== 429) {
    throw new ApiError(`Refresh failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as RefreshResponse;
}

/** True once the ranking was generated after the refresh was requested. */
export function includesRefresh(generatedAt: string | null, requestedAt: string): boolean {
  return generatedAt !== null && new Date(generatedAt).getTime() >= new Date(requestedAt).getTime();
}

/** 90 → "2 min", 30 → "1 min" (never "0 min"). */
export function formatWait(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}
