import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';
import { TopStory } from '../common/interfaces/top-story.interface';
import { ScoringWeights } from '../config/scoring-weights';
import { dominantType, StoryCluster } from '../processing/clustering';
import { AnalyzedItem } from '../processing/entities';
import { cleanSummary } from '../processing/summary';
import { artistKey, jaccard } from '../processing/text';
import { sourceAuthority } from '../sources/news-sources.config';
import {
  computeScore,
  confidenceFor,
  freshnessSignal,
  geographicReachSignal,
  sourceVolumeSignal,
  trendLevel,
  velocitySignal,
  verificationStatus,
} from './scoring';

export type UnrankedStory = Omit<TopStory, 'rank'>;

const MAX_ARTISTS = 3;
const MAX_GENRES = 3;
const MAX_DEFAULT_GENRES = 2;

function byFrequency<T>(values: T[], key: (value: T) => string = String): T[] {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    const k = key(value);
    const entry = counts.get(k);
    if (entry) entry.count++;
    else counts.set(k, { value, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.value);
}

export type ArtistGenreIndex = Map<string, Genre[]>;

/**
 * Genres each artist was given by any item in this run, most frequent
 * first. Lets a story whose own coverage names no genre borrow one from
 * other coverage of the same artist, before falling back to outlet defaults.
 */
export function buildArtistGenreIndex(items: AnalyzedItem[]): ArtistGenreIndex {
  const collected = new Map<string, Genre[]>();
  for (const item of items) {
    if (item.genres.length === 0) continue;
    for (const key of item.artistKeys) {
      collected.set(key, [...(collected.get(key) ?? []), ...item.genres]);
    }
  }
  return new Map(
    [...collected].map(([key, genres]) => [key, byFrequency(genres)]),
  );
}

/**
 * The headline that shares the most wording with the rest of the coverage -
 * the one closest to "what everyone is reporting" - rather than a side
 * angle that happens to come from the biggest outlet. Authority, then
 * earliest publication, break ties (and decide 1–2 item stories).
 */
export function consensusItem(items: AnalyzedItem[]): AnalyzedItem {
  const agreement = (item: AnalyzedItem) =>
    items.reduce(
      (sum, other) =>
        other === item ? sum : sum + jaccard(item.keywords, other.keywords),
      0,
    );

  return [...items]
    .map((item) => ({ item, agreement: agreement(item) }))
    .sort(
      (a, b) =>
        b.agreement - a.agreement ||
        sourceAuthority(b.item.source) - sourceAuthority(a.item.source) ||
        a.item.publishedAt.getTime() - b.item.publishedAt.getTime(),
    )[0].item;
}

function storySummary(
  representative: AnalyzedItem,
  items: AnalyzedItem[],
): string | undefined {
  const candidates = [
    representative,
    ...[...items]
      .filter((item) => item !== representative)
      .sort((a, b) => sourceAuthority(b.source) - sourceAuthority(a.source)),
  ];
  for (const item of candidates) {
    const summary = cleanSummary(item.description, [item.title]);
    if (summary) return summary;
  }
  return undefined;
}

/**
 * Turns a cluster into a scored story. `velocity` comes from the trend
 * store's samples for this cluster id (spec 15).
 */
export function buildStory(
  cluster: StoryCluster,
  velocity: number,
  now: Date,
  weights: ScoringWeights,
  artistGenres: ArtistGenreIndex = new Map(),
): UnrankedStory {
  const { items } = cluster;
  const representative = consensusItem(items);

  // One link per outlet, most authoritative first.
  const sources = [...new Map(items.map((item) => [item.source, item]))]
    .map(([name, item]) => ({ name, url: item.url }))
    .sort((a, b) => sourceAuthority(b.name) - sourceAuthority(a.name));

  const regions = [
    ...new Set(
      items
        .map((item) => item.region as Region | undefined)
        .filter((region): region is Region => region !== undefined),
    ),
  ];
  const artists = byFrequency(
    items.flatMap((item) => item.artists),
    artistKey,
  ).slice(0, MAX_ARTISTS);

  // Most specific evidence first: what this coverage says, then what other
  // coverage says about the same artists, then what the outlets usually
  // cover. A pop story on a metal site is still a pop story.
  const detectedGenres = byFrequency(items.flatMap((item) => item.genres));
  const artistKnownGenres = byFrequency(
    artists.flatMap((name) => artistGenres.get(artistKey(name)) ?? []),
  );
  const genres =
    detectedGenres.length > 0
      ? detectedGenres.slice(0, MAX_GENRES)
      : artistKnownGenres.length > 0
        ? artistKnownGenres.slice(0, MAX_GENRES)
        : byFrequency(items.flatMap((item) => item.sourceGenres)).slice(
            0,
            MAX_DEFAULT_GENRES,
          );
  const times = items.map((item) => item.publishedAt.getTime());
  const lastSeen = new Date(Math.max(...times));
  const maxAuthority = Math.max(...sources.map((s) => sourceAuthority(s.name)));

  const score = computeScore(
    {
      sourceVolume: sourceVolumeSignal(sources.length),
      velocity: velocitySignal(velocity),
      engagement: undefined,
      authority: maxAuthority,
      geographicReach: geographicReachSignal(regions.length),
      freshness: freshnessSignal(lastSeen, now),
    },
    weights,
  );

  const status = verificationStatus({
    sourceCount: sources.length,
    rumorItems: items.filter((item) => item.rumor).length,
    totalItems: items.length,
    maxAuthority,
  });

  return {
    id: cluster.id,
    title: representative.title,
    summary: storySummary(representative, items),
    artists,
    type: dominantType(items),
    regions,
    genres: genres.length > 0 ? genres : [Genre.OTHER],
    score,
    trendLevel: trendLevel(score),
    sourceCount: sources.length,
    confidence: confidenceFor(status),
    verificationStatus: status,
    velocity: Math.round(velocity * 100) / 100,
    sources,
    firstSeenAt: new Date(Math.min(...times)).toISOString(),
    lastSeenAt: lastSeen.toISOString(),
  };
}
