import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';

export interface NewsSourceConfig {
  name: string;
  feedUrl: string;
  region: Region;
  /** 0–1. How much a mention from this outlet counts (spec section 21). */
  authority: number;
  /** Genres the outlet covers by default, used when a story has no genre signal. */
  genres?: Genre[];
  enabled: boolean;
  /** Why a source is disabled, so re-enabling it is a deliberate decision. */
  note?: string;
}

/**
 * RSS sources (spec section 6). Adding or disabling an outlet is a config
 * change only - the collector builds one RssAdapter per enabled entry.
 */
export const NEWS_SOURCES: NewsSourceConfig[] = [
  // Argentina / Latin America
  {
    name: 'Indie Hoy',
    feedUrl: 'https://indiehoy.com/feed/',
    region: Region.ARGENTINA,
    authority: 0.75,
    enabled: true,
  },
  {
    name: 'Billboard Argentina',
    feedUrl: 'https://billboard.ar/feed/',
    region: Region.ARGENTINA,
    authority: 0.85,
    enabled: true,
  },
  {
    name: 'Rolling Stone en Español',
    feedUrl: 'https://es.rollingstone.com/feed/',
    region: Region.ARGENTINA,
    authority: 0.8,
    enabled: true,
  },
  {
    name: 'Rolling Stone Argentina',
    feedUrl:
      'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/revista-rolling-stone/?outputType=xml',
    region: Region.ARGENTINA,
    authority: 0.85,
    enabled: false,
    note: 'Feed responds but returns 0 items (checked 2026-09-28).',
  },

  // United States
  {
    name: 'Rolling Stone',
    feedUrl: 'https://www.rollingstone.com/music/music-news/feed/',
    region: Region.USA,
    authority: 0.95,
    enabled: true,
  },
  {
    name: 'Pitchfork',
    feedUrl: 'https://pitchfork.com/feed/feed-news/rss',
    region: Region.USA,
    authority: 0.9,
    enabled: true,
  },
  {
    name: 'Billboard',
    feedUrl: 'https://www.billboard.com/c/music/music-news/feed/',
    region: Region.USA,
    authority: 0.95,
    enabled: true,
  },
  {
    name: 'Stereogum',
    feedUrl: 'https://www.stereogum.com/category/news/feed/',
    region: Region.USA,
    authority: 0.8,
    enabled: true,
  },
  {
    name: 'Consequence',
    feedUrl: 'https://consequence.net/category/music/feed/',
    region: Region.USA,
    authority: 0.8,
    enabled: true,
  },
  {
    name: 'Spin',
    feedUrl: 'https://www.spin.com/feed/',
    region: Region.USA,
    authority: 0.75,
    enabled: true,
  },
  {
    name: 'BrooklynVegan',
    feedUrl: 'https://www.brooklynvegan.com/feed/',
    region: Region.USA,
    authority: 0.7,
    enabled: true,
  },
  {
    name: 'Loudwire',
    feedUrl: 'https://loudwire.com/feed/',
    region: Region.USA,
    authority: 0.7,
    genres: [Genre.METAL, Genre.ROCK],
    enabled: true,
  },
  {
    name: 'Metal Injection',
    feedUrl: 'https://metalinjection.net/feed',
    region: Region.USA,
    authority: 0.65,
    genres: [Genre.METAL],
    enabled: true,
  },

  // Europe / UK
  {
    name: 'NME',
    feedUrl: 'https://www.nme.com/news/music/feed',
    region: Region.EUROPE,
    authority: 0.85,
    enabled: true,
  },
  {
    name: 'Uncut',
    feedUrl: 'https://www.uncut.co.uk/feed/',
    region: Region.EUROPE,
    authority: 0.75,
    genres: [Genre.ROCK],
    enabled: true,
  },
  {
    name: 'Dork',
    feedUrl: 'https://readdork.com/feed/',
    region: Region.EUROPE,
    authority: 0.65,
    genres: [Genre.INDIE, Genre.ALTERNATIVE],
    enabled: true,
  },
  {
    name: 'Kerrang!',
    feedUrl: 'https://www.kerrang.com/feed',
    region: Region.EUROPE,
    authority: 0.8,
    genres: [Genre.METAL, Genre.PUNK, Genre.ROCK],
    enabled: false,
    note: 'Feed URL returns 404 (checked 2026-09-28); needs the current URL.',
  },
  {
    name: 'Metal Hammer',
    feedUrl: 'https://www.loudersound.com/feeds/metal-hammer/news',
    region: Region.EUROPE,
    authority: 0.8,
    genres: [Genre.METAL],
    enabled: false,
    note: 'Feed only returns items from 2023 (checked 2026-09-28).',
  },
  {
    name: 'The Guardian Music',
    feedUrl: 'https://www.theguardian.com/music/rss',
    region: Region.EUROPE,
    authority: 0.9,
    enabled: false,
    note: 'rss-parser fails on this feed ("Cannot convert object to primitive value").',
  },
  {
    name: 'MOJO',
    feedUrl: 'https://www.mojo4music.com/feed/',
    region: Region.EUROPE,
    authority: 0.75,
    enabled: false,
    note: 'Feed URL returns 404 (checked 2026-09-28).',
  },
  {
    name: 'Clash',
    feedUrl: 'https://www.clashmusic.com/feed/',
    region: Region.EUROPE,
    authority: 0.7,
    enabled: false,
    note: 'Returns 403 to server-side requests (checked 2026-09-28).',
  },
  {
    name: 'DIY',
    feedUrl: 'https://diymag.com/feed',
    region: Region.EUROPE,
    authority: 0.7,
    enabled: false,
    note: 'rss-parser fails on this feed ("Cannot convert object to primitive value").',
  },
];

const DEFAULT_AUTHORITY = 0.5;

export function findNewsSource(name: string): NewsSourceConfig | undefined {
  return NEWS_SOURCES.find((source) => source.name === name);
}

export function sourceAuthority(name: string): number {
  return findNewsSource(name)?.authority ?? DEFAULT_AUTHORITY;
}
