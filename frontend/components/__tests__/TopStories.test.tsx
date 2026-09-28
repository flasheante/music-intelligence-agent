import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopStories } from "@/components/TopStories";
import type { TopStory } from "@/types/api";

function story(overrides: Partial<TopStory>): TopStory {
  return {
    rank: 1,
    id: "story",
    title: "Headline",
    artists: [],
    type: "ALBUM",
    regions: ["USA"],
    genres: ["ROCK"],
    score: 8,
    trendLevel: "VERY_HIGH",
    sourceCount: 4,
    confidence: 0.9,
    verificationStatus: "CONFIRMED",
    velocity: 0.5,
    sources: [],
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: async () => response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TopStories", () => {
  it("renders every story in rank order", async () => {
    mockFetch({
      generatedAt: new Date().toISOString(),
      stories: [
        story({ rank: 1, id: "a", title: "Primera historia", artists: ["Slipknot"] }),
        story({ rank: 2, id: "b", title: "Segunda historia" }),
      ],
    });

    render(<TopStories />);

    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Primera historia", "Segunda historia"]);
    expect(screen.getByLabelText("Puesto 1")).toBeInTheDocument();
    expect(screen.getByText("Slipknot")).toBeInTheDocument();
  });

  it("asks the api for the selected region", async () => {
    const fetchMock = mockFetch({ generatedAt: null, stories: [story({})] });

    render(<TopStories />);
    await screen.findByText("Headline");

    fireEvent.click(screen.getByRole("radio", { name: "Argentina" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/api\/news\/top\?region=argentina$/),
        expect.anything(),
      ),
    );
  });

  it("shows an empty state before the first ranking run", async () => {
    mockFetch({ generatedAt: null, stories: [] });

    render(<TopStories />);

    expect(await screen.findByText(/todavía no hay ranking/i)).toBeInTheDocument();
  });

  it("shows a human readable message when the api is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<TopStories />);

    expect(await screen.findByText(/no pudimos cargar el ranking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
