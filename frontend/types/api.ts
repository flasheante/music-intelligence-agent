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
