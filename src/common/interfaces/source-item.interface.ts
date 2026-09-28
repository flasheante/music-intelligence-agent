export type SourceType = 'news' | 'youtube' | 'social';

export interface SourceItemEngagement {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

/**
 * Normalized shape every collector must produce.
 * Raw payloads from the origin source are never persisted past this transformation.
 */
export interface SourceItem {
  source: string;
  sourceType: SourceType;
  title?: string;
  description?: string;
  url: string;
  publishedAt?: Date;

  artist?: string;
  region?: string;
  genre?: string;
  /** Outlet-assigned categories/tags; often name the artist the item is about. */
  tags?: string[];

  engagement?: SourceItemEngagement;
}
