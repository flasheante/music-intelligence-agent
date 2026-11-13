import "server-only";
import { redis } from "@/lib/server/redis";
import type { RefreshResponse } from "@/types/api";

/**
 * Held while a visitor-triggered refresh is cooling down. Its value is when
 * that refresh was requested, so later visitors can tell whether the ranking
 * they're looking at already includes it.
 */
const REFRESH_LOCK_KEY = "music:refresh-lock";
const DEFAULT_COOLDOWN_MINUTES = 30;
const GITHUB_API = "https://api.github.com";

export class RefreshNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`${missing} is not set`);
    this.name = "RefreshNotConfiguredError";
  }
}

export class WorkflowDispatchError extends Error {
  constructor(readonly status: number) {
    super(`GitHub rejected the workflow dispatch with status ${status}`);
    this.name = "WorkflowDispatchError";
  }
}

/** Same rule as TOP_NEWS_LIMIT: a blank or invalid value falls back to the default. */
function cooldownSeconds(): number {
  const parsed = Number.parseInt(process.env.REFRESH_COOLDOWN_MINUTES ?? "", 10);
  const minutes = Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_COOLDOWN_MINUTES;
  return minutes * 60;
}

type GithubConfig = { token: string; repo: string; workflow: string; ref: string };

function githubConfig(): GithubConfig {
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  if (!token) throw new RefreshNotConfiguredError("GITHUB_DISPATCH_TOKEN");
  if (!repo) throw new RefreshNotConfiguredError("GITHUB_REPO");

  return {
    token,
    repo,
    workflow: process.env.GITHUB_WORKFLOW?.trim() || "refresh.yml",
    ref: process.env.GITHUB_REF_NAME?.trim() || "main",
  };
}

/** Starts the "Refresh Top 10" GitHub Actions workflow (workflow_dispatch). */
async function dispatchWorkflow(config: GithubConfig): Promise<void> {
  const response = await fetch(
    `${GITHUB_API}/repos/${config.repo}/actions/workflows/${config.workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: config.ref }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new WorkflowDispatchError(response.status);
  }
}

/**
 * Starts a pipeline run unless one was requested within the cooldown. The
 * lock is taken before calling GitHub, so concurrent clicks from many
 * visitors still start a single run; it's released if GitHub refuses.
 */
export async function requestRefresh(): Promise<RefreshResponse> {
  const config = githubConfig();
  const ttl = cooldownSeconds();
  const requestedAt = new Date().toISOString();
  const client = redis();

  const acquired = await client.set(REFRESH_LOCK_KEY, requestedAt, "EX", ttl, "NX");

  if (acquired !== "OK") {
    const [previous, remaining] = await Promise.all([
      client.get(REFRESH_LOCK_KEY),
      client.ttl(REFRESH_LOCK_KEY),
    ]);
    return {
      status: "cooldown",
      requestedAt: previous,
      retryAfterSeconds: Math.max(remaining, 1),
    };
  }

  try {
    await dispatchWorkflow(config);
  } catch (error) {
    await client.del(REFRESH_LOCK_KEY).catch(() => undefined);
    throw error;
  }

  return { status: "started", requestedAt, retryAfterSeconds: ttl };
}
