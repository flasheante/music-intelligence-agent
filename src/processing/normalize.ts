import { SourceItem } from '../common/interfaces/source-item.interface';
import { decodeEntities } from './text';

export interface NormalizedItem extends SourceItem {
  title: string;
  publishedAt: Date;
}

export interface NormalizeOptions {
  now: Date;
  maxAgeHours: number;
}

export interface NormalizeResult {
  items: NormalizedItem[];
  discarded: number;
}

/** Small clock skew in feeds is fine; anything further ahead is bogus. */
const MAX_FUTURE_MS = 60 * 60 * 1000;

export function cleanTitle(title: string): string {
  return decodeEntities(title).replace(/\s+/g, ' ').trim();
}

/** Same article reached via tracking params or a trailing slash is one item. */
export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

/**
 * Cheap deterministic filters (spec 33): drops items with no title/URL/date,
 * items outside the freshness window, and duplicate URLs.
 */
export function normalizeItems(
  items: SourceItem[],
  { now, maxAgeHours }: NormalizeOptions,
): NormalizeResult {
  const oldest = now.getTime() - maxAgeHours * 3600 * 1000;
  const seenUrls = new Set<string>();
  const normalized: NormalizedItem[] = [];

  for (const item of items) {
    const title = item.title ? cleanTitle(item.title) : '';
    const time = item.publishedAt?.getTime();

    if (!title || !item.url || time === undefined || Number.isNaN(time)) {
      continue;
    }
    if (time < oldest || time > now.getTime() + MAX_FUTURE_MS) {
      continue;
    }

    const url = canonicalUrl(item.url);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    normalized.push({
      ...item,
      title,
      url,
      description: item.description
        ? decodeEntities(item.description)
        : undefined,
      publishedAt: new Date(Math.min(time, now.getTime())),
      tags: item.tags?.map((tag) => decodeEntities(tag)),
    });
  }

  return { items: normalized, discarded: items.length - normalized.length };
}
