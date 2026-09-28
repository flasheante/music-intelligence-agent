import { apiFetch } from "@/lib/api";
import type { HealthResponse } from "@/types/api";

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("api/health", { cache: "no-store" });
}
