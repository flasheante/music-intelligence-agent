/**
 * Thin client for the app's own read-only API (app/api/*), which reads the
 * ranking the backend pipeline writes to Redis. Same origin, so no base URL.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for a network failure (no response at all). */
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiUrl(path: string): string {
  return `/${path.replace(/^\//, "")}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    // No response at all: offline, DNS failure, CORS, etc.
    throw new ApiError("Network error", 0);
  }

  if (!response.ok) {
    throw new ApiError(
      `Request to ${path} failed with status ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}
