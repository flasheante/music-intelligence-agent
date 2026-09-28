import { Genre } from '../enums/genre.enum';
import { Region } from '../enums/region.enum';
import { StoryType } from '../enums/story-type.enum';
import { VerificationStatus } from '../enums/verification-status.enum';

export type TrendLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface TopStorySource {
  name: string;
  url: string;
}

/**
 * One ranked story (spec section 23). A derived summary of a cluster -
 * never a raw article - so it respects the "no news archive" rule.
 */
export interface TopStory {
  rank: number;
  /** Cluster/topic slug, stable across runs while the story lives. */
  id: string;
  title: string;
  /** Filled by the AI editor (spec 20); absent until that stage exists. */
  summary?: string;
  artists: string[];
  type: StoryType;
  regions: Region[];
  genres: Genre[];
  /** Weighted trend score, 0–10. */
  score: number;
  trendLevel: TrendLevel;
  sourceCount: number;
  /** 0–1. */
  confidence: number;
  verificationStatus: VerificationStatus;
  /** Growth rate in source count since the story was first seen, e.g. 0.5 = +50%. */
  velocity: number;
  sources: TopStorySource[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface TopStoriesSnapshot {
  generatedAt: string | null;
  stories: TopStory[];
}
