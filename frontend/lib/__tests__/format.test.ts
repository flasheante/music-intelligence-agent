import { describe, expect, it } from "vitest";
import { formatRelative, formatVelocity, genreLabel, storyTypeLabel } from "@/lib/format";

describe("formatVelocity", () => {
  it("formats growth as a signed percentage", () => {
    expect(formatVelocity(0.82)).toBe("+82%");
    expect(formatVelocity(-0.1)).toBe("-10%");
    expect(formatVelocity(0)).toBe("0%");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-28T12:00:00Z").getTime();

  it("uses minutes, hours and days", () => {
    expect(formatRelative("2026-09-28T12:00:00Z", now)).toBe("recién");
    expect(formatRelative("2026-09-28T11:55:00Z", now)).toBe("hace 5 min");
    expect(formatRelative("2026-09-28T09:00:00Z", now)).toBe("hace 3 h");
    expect(formatRelative("2026-09-27T12:00:00Z", now)).toBe("hace 1 día");
    expect(formatRelative("2026-09-25T12:00:00Z", now)).toBe("hace 3 días");
  });
});

describe("labels", () => {
  it("translates known values and humanizes unknown ones", () => {
    expect(storyTypeLabel("REUNION")).toBe("Reunión");
    expect(storyTypeLabel("SOMETHING_NEW")).toBe("Something new");
    expect(genreLabel("HIP_HOP")).toBe("Hip hop");
    expect(genreLabel("ROCK")).toBe("Rock");
  });
});
