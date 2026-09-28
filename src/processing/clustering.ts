import { StoryType } from '../common/enums/story-type.enum';
import { AnalyzedItem } from './entities';
import { jaccard, slugify } from './text';

export interface StoryCluster {
  /** Stable across runs while the story lives, so velocity samples line up. */
  id: string;
  items: AnalyzedItem[];
}

export interface ClusterOptions {
  windowHours: number;
}

/**
 * Story types that describe the same kind of event: "album" in one outlet
 * and "single" in another are usually the same release news.
 */
const TYPE_FAMILIES: StoryType[][] = [
  [
    StoryType.NEW_RELEASE,
    StoryType.ALBUM,
    StoryType.SINGLE,
    StoryType.MUSIC_VIDEO,
  ],
  [StoryType.TOUR, StoryType.CONCERT, StoryType.FESTIVAL, StoryType.REUNION],
];

/** Too vague to tell two stories apart on their own. */
const WILDCARD_TYPES = new Set([StoryType.OTHER, StoryType.ANNOUNCEMENT]);

function familyOf(type: StoryType): StoryType[] | undefined {
  return TYPE_FAMILIES.find((family) => family.includes(type));
}

export function compatibleTypes(a: StoryType, b: StoryType): boolean {
  if (a === b || WILDCARD_TYPES.has(a) || WILDCARD_TYPES.has(b)) return true;
  const family = familyOf(a);
  return family !== undefined && family.includes(b);
}

/** Headlines this close are the same story even with no artist detected. */
const SAME_HEADLINE_SIMILARITY = 0.5;
/**
 * Sharing an artist plus this much *other* wording overrides a type
 * mismatch. Artist-name words are excluded, or the shared name alone would
 * clear the bar.
 */
const SAME_ARTIST_SIMILARITY = 0.15;

function withoutArtistWords(item: AnalyzedItem, artistWords: Set<string>) {
  return item.keywords.filter((word) => !artistWords.has(word));
}

export function isSameStory(
  a: AnalyzedItem,
  b: AnalyzedItem,
  { windowHours }: ClusterOptions,
): boolean {
  const hoursApart =
    Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 3_600_000;
  if (hoursApart > windowHours) return false;

  const similarity = jaccard(a.keywords, b.keywords);
  if (similarity >= SAME_HEADLINE_SIMILARITY) return true;

  const sharesArtist = a.artistKeys.some((key) => b.artistKeys.includes(key));
  if (!sharesArtist) return false;

  const artistWords = new Set(
    [...a.artistKeys, ...b.artistKeys].flatMap((key) => key.split(' ')),
  );
  const contextSimilarity = jaccard(
    withoutArtistWords(a, artistWords),
    withoutArtistWords(b, artistWords),
  );
  if (contextSimilarity >= SAME_ARTIST_SIMILARITY) return true;

  // With little shared wording, the shared artist must be the protagonist of
  // both headlines: a guest in one story isn't evidence it's the same event.
  const sameProtagonist =
    a.artistKeys[0] !== undefined && a.artistKeys[0] === b.artistKeys[0];
  return sameProtagonist && compatibleTypes(a.storyType, b.storyType);
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function dominantType(items: AnalyzedItem[]): StoryType {
  const specific = items
    .map((item) => item.storyType)
    .filter((type) => !WILDCARD_TYPES.has(type));
  return (
    mostCommon(specific) ??
    mostCommon(items.map((item) => item.storyType)) ??
    StoryType.OTHER
  );
}

function clusterId(items: AnalyzedItem[]): string {
  const type = dominantType(items);
  const family = familyOf(type)?.[0] ?? type;
  const artist = mostCommon(
    items
      .map((item) => item.artistKeys[0])
      .filter((key): key is string => key !== undefined),
  );

  if (artist) return slugify(`${artist} ${family}`);

  // No artist: the earliest headline's leading keywords identify the story.
  const earliest = [...items].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
  )[0];
  return slugify(earliest.keywords.slice(0, 5).join(' '));
}

/** An item joins a story only if it matches at least this share of its items. */
const MIN_CLUSTER_AGREEMENT = 0.5;

/**
 * Groups items that cover the same event (spec 13). Items are placed in
 * publication order into the story they agree with most, and only if they
 * match at least half of its items. Plain transitive linking (A~B, B~C ⇒ one
 * story) chains unrelated coverage of a shared event - every VMAs moment
 * into a single "story" - so it's deliberately avoided.
 */
export function clusterItems(
  items: AnalyzedItem[],
  options: ClusterOptions,
): StoryCluster[] {
  const groups: AnalyzedItem[][] = [];
  const ordered = [...items].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
  );

  for (const item of ordered) {
    let best: AnalyzedItem[] | undefined;
    let bestAgreement = 0;

    for (const group of groups) {
      const matches = group.filter((member) =>
        isSameStory(item, member, options),
      ).length;
      const agreement = matches / group.length;
      if (
        matches > 0 &&
        agreement >= MIN_CLUSTER_AGREEMENT &&
        agreement > bestAgreement
      ) {
        best = group;
        bestAgreement = agreement;
      }
    }

    if (best) best.push(item);
    else groups.push([item]);
  }

  // Two distinct stories can still derive the same id (same artist, same
  // type family, unlinked coverage); suffix to keep ids unique per run.
  const usedIds = new Map<string, number>();
  return groups.map((group) => {
    const base = clusterId(group);
    const seen = usedIds.get(base) ?? 0;
    usedIds.set(base, seen + 1);
    return { id: seen === 0 ? base : `${base}-${seen + 1}`, items: group };
  });
}
