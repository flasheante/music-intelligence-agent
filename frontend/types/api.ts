export type HealthResponse = {
  status: "ok";
  redis: "ok";
};

export type Region = "ARGENTINA" | "USA" | "EUROPE" | "GLOBAL";

export type VerificationStatus = "CONFIRMED" | "LIKELY" | "UNCONFIRMED" | "RUMOR";

export type TrendLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type TopStorySource = {
  name: string;
  url: string;
};

/** Mirrors src/common/interfaces/top-story.interface.ts in the backend. */
export type TopStory = {
  rank: number;
  id: string;
  title: string;
  summary?: string;
  artists: string[];
  type: string;
  regions: Region[];
  genres: string[];
  /** 0–10. */
  score: number;
  trendLevel: TrendLevel;
  sourceCount: number;
  confidence: number;
  verificationStatus: VerificationStatus;
  velocity: number;
  sources: TopStorySource[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type TopStoriesSnapshot = {
  generatedAt: string | null;
  stories: TopStory[];
};

/** POST /api/refresh: 202 when a pipeline run was started, 429 while cooling down. */
export type RefreshResponse = {
  status: "started" | "cooldown";
  /** When the latest refresh was requested (ISO), or null if unknown. */
  requestedAt: string | null;
  /** Seconds until another refresh can be requested. */
  retryAfterSeconds: number;
};
