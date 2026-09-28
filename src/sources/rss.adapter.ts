import Parser from 'rss-parser';
import {
  RawSourceItem,
  SourceAdapter,
} from '../common/interfaces/source-adapter.interface';
import { SourceItem } from '../common/interfaces/source-item.interface';
import { NewsSourceConfig } from './news-sources.config';

export interface RawRssItem extends RawSourceItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  categories?: unknown[];
}

const FETCH_TIMEOUT_MS = 15_000;
/** Room for a standfirst plus feed boilerplate; the full article is never kept (spec 3.2). */
const MAX_DESCRIPTION_LENGTH = 500;

export class RssAdapter implements SourceAdapter<RawRssItem> {
  readonly sourceType = 'news' as const;

  constructor(
    private readonly config: NewsSourceConfig,
    private readonly parser: Parser = new Parser({
      timeout: FETCH_TIMEOUT_MS,
      headers: { 'User-Agent': 'music-intelligence-agent/0.1 (+rss reader)' },
    }),
  ) {}

  get name(): string {
    return this.config.name;
  }

  async getItems(): Promise<RawRssItem[]> {
    const feed = await this.parser.parseURL(this.config.feedUrl);
    return feed.items;
  }

  normalize(raw: RawRssItem): SourceItem {
    const date = raw.isoDate ?? raw.pubDate;
    const publishedAt = date ? new Date(date) : undefined;

    return {
      source: this.config.name,
      sourceType: this.sourceType,
      title: raw.title?.trim(),
      description: raw.contentSnippet
        ?.replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DESCRIPTION_LENGTH),
      url: raw.link?.trim() ?? '',
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt
          : undefined,
      region: this.config.region,
      genre: this.config.genres?.[0],
      tags: normalizeCategories(raw.categories),
    };
  }
}

/** rss-parser yields strings, or `{ _: 'Name' }` objects for some feeds. */
function normalizeCategories(categories: unknown[] | undefined): string[] {
  if (!categories) return [];

  return categories
    .map((category) => {
      if (typeof category === 'string') return category;
      if (category && typeof category === 'object' && '_' in category) {
        const value = category._;
        return typeof value === 'string' ? value : '';
      }
      return '';
    })
    .map((category) => category.trim())
    .filter(Boolean);
}
