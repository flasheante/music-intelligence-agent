import Parser from 'rss-parser';
import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';
import { SourceAdapter } from '../common/interfaces/source-adapter.interface';
import { CollectorService } from './collector.service';
import { RssAdapter } from './rss.adapter';

const config = {
  name: 'Loudwire',
  feedUrl: 'https://loudwire.com/feed/',
  region: Region.USA,
  authority: 0.7,
  genres: [Genre.METAL],
  enabled: true,
};

describe('RssAdapter', () => {
  it('normalizes an RSS item into a SourceItem', () => {
    const adapter = new RssAdapter(config, {} as Parser);

    const item = adapter.normalize({
      title: ' Slipknot Announce Tour ',
      link: 'https://loudwire.com/slipknot',
      isoDate: '2026-09-28T10:00:00.000Z',
      contentSnippet: 'x'.repeat(1000),
      categories: ['News', { _: 'Slipknot' }],
    });

    expect(item).toMatchObject({
      source: 'Loudwire',
      sourceType: 'news',
      title: 'Slipknot Announce Tour',
      url: 'https://loudwire.com/slipknot',
      publishedAt: new Date('2026-09-28T10:00:00.000Z'),
      region: Region.USA,
      genre: Genre.METAL,
      tags: ['News', 'Slipknot'],
    });
    expect(item.description).toHaveLength(500);
  });

  it('leaves an unparseable date undefined', () => {
    const adapter = new RssAdapter(config, {} as Parser);
    expect(
      adapter.normalize({ title: 't', link: 'u', pubDate: 'not a date' })
        .publishedAt,
    ).toBeUndefined();
  });
});

describe('CollectorService', () => {
  it('keeps going when one source fails', async () => {
    const ok: SourceAdapter = {
      name: 'OK',
      sourceType: 'news',
      getItems: () => Promise.resolve([{ id: 1 }]),
      normalize: () => ({ source: 'OK', sourceType: 'news', url: 'u' }),
    };
    const broken: SourceAdapter = {
      name: 'Broken',
      sourceType: 'news',
      getItems: () => Promise.reject(new Error('Status code 503')),
      normalize: jest.fn(),
    };

    const result = await new CollectorService([ok, broken]).collect();

    expect(result.items).toHaveLength(1);
    expect(result.sources).toEqual([
      { source: 'OK', ok: true, items: 1 },
      { source: 'Broken', ok: false, items: 0, error: 'Status code 503' },
    ]);
  });
});
