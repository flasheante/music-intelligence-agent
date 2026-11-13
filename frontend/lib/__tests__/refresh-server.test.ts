// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const redisMock = {
  set: vi.fn(),
  get: vi.fn(),
  ttl: vi.fn(),
  del: vi.fn(),
};
vi.mock("@/lib/server/redis", () => ({ redis: () => redisMock }));

const { requestRefresh, RefreshNotConfiguredError, WorkflowDispatchError } = await import(
  "@/lib/server/refresh"
);

describe("requestRefresh", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "token");
    vi.stubEnv("GITHUB_REPO", "owner/repo");
    vi.stubEnv("REFRESH_COOLDOWN_MINUTES", "");
    redisMock.del.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("takes the lock and dispatches the workflow", async () => {
    redisMock.set.mockResolvedValue("OK");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestRefresh();

    expect(result).toMatchObject({ status: "started", retryAfterSeconds: 30 * 60 });
    expect(redisMock.set).toHaveBeenCalledWith(
      "music:refresh-lock",
      result.requestedAt,
      "EX",
      1800,
      "NX",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/actions/workflows/refresh.yml/dispatches",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ ref: "main" }) }),
    );
  });

  it("reports the cooldown without calling GitHub while the lock is held", async () => {
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValue("2026-11-13T12:00:00.000Z");
    redisMock.ttl.mockResolvedValue(600);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestRefresh()).resolves.toEqual({
      status: "cooldown",
      requestedAt: "2026-11-13T12:00:00.000Z",
      retryAfterSeconds: 600,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("releases the lock when GitHub rejects the dispatch", async () => {
    redisMock.set.mockResolvedValue("OK");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(requestRefresh()).rejects.toBeInstanceOf(WorkflowDispatchError);
    expect(redisMock.del).toHaveBeenCalledWith("music:refresh-lock");
  });

  it("refuses before touching Redis when the token is missing", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");

    await expect(requestRefresh()).rejects.toBeInstanceOf(RefreshNotConfiguredError);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("honours REFRESH_COOLDOWN_MINUTES", async () => {
    vi.stubEnv("REFRESH_COOLDOWN_MINUTES", "10");
    redisMock.set.mockResolvedValue("OK");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await expect(requestRefresh()).resolves.toMatchObject({ retryAfterSeconds: 600 });
  });
});
