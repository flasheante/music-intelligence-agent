import { SourceItem } from '../common/interfaces/source-item.interface';
import { canonicalUrl, cleanTitle, normalizeItems } from './normalize';

const now = new Date('2026-09-28T12:00:00Z');

function item(overrides: Partial<SourceItem>): SourceItem {
  return {
    source: 'NME',
    sourceType: 'news',
    title: 'Title',
    url: 'https://example.com/a',
    publishedAt: new Date('2026-09-28T10:00:00Z'),
    ...overrides,
  };
}

describe('cleanTitle', () => {
  it('decodes entities and collapses whitespace', () => {
    expect(cleanTitle('  Guns N&#8217; Roses &amp;  friends ')).toBe(
      'Guns N’ Roses & friends',
    );
  });
});

describe('canonicalUrl', () => {
  it('drops query, hash and trailing slash', () => {
    expect(canonicalUrl('https://example.com/a/?utm_source=x#top')).toBe(
      'https://example.com/a',
    );
  });
});

describe('normalizeItems', () => {
  it('keeps fresh items and discards stale, undated, untitled and duplicate ones', () => {
    const result = normalizeItems(
      [
        item({ url: 'https://example.com/fresh' }),
        item({ url: 'https://example.com/fresh/?ref=rss' }),
        item({
          url: 'https://example.com/old',
          publishedAt: new Date('2026-09-25T00:00:00Z'),
        }),
        item({ url: 'https://example.com/undated', publishedAt: undefined }),
        item({ url: 'https://example.com/untitled', title: '   ' }),
      ],
      { now, maxAgeHours: 48 },
    );

    expect(result.items.map((i) => i.url)).toEqual([
      'https://example.com/fresh',
    ]);
    expect(result.discarded).toBe(4);
  });

  it('clamps slightly-future dates to now', () => {
    const { items } = normalizeItems(
      [item({ publishedAt: new Date('2026-09-28T12:30:00Z') })],
      { now, maxAgeHours: 48 },
    );
    expect(items[0].publishedAt).toEqual(now);
  });
});
