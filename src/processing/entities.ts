import { Genre } from '../common/enums/genre.enum';
import { StoryType } from '../common/enums/story-type.enum';
import { findNewsSource } from '../sources/news-sources.config';
import { NormalizedItem } from './normalize';
import { artistKey, fold, isStopword, keywords } from './text';

export interface AnalyzedItem extends NormalizedItem {
  artists: string[];
  artistKeys: string[];
  storyType: StoryType;
  /** Genres the item itself signals (title/tags). */
  genres: Genre[];
  /** The outlet's default genres; only used when no item signals a genre. */
  sourceGenres: Genre[];
  rumor: boolean;
  /** Not music news (film/series/books coverage from culture outlets). */
  offTopic: boolean;
  keywords: string[];
}

const foldAll = (values: string[]) => new Set(values.map(fold));

/** Outlet tags that are sections or genres, never an artist. */
const GENERIC_TAGS = foldAll([
  'news',
  'music',
  'music news',
  'latest news',
  'noticias',
  'música',
  'shows',
  'historias',
  'interviews',
  'entrevistas',
  'reviews',
  'video',
  'videos',
  'tour',
  'tours',
  'festival',
  'festivals',
  'album',
  'albums',
  'single',
  'new music',
  'lanzamientos',
  'rock',
  'metal',
  'pop',
  'punk',
  'indie',
  'hip hop',
  'hip-hop',
  'rap',
  'country',
  'jazz',
  'latin',
  'electronic',
  'alternative',
]);

/**
 * Award shows, TV programmes and platforms. They show up as tags on many
 * unrelated stories ("VMAs" on every VMAs moment), so treating them as an
 * artist would chain separate stories into one.
 */
const EVENT_AND_PLATFORM_TAGS = foldAll([
  'vmas',
  'vma',
  'mtv',
  'mtv vmas',
  'grammys',
  'grammy',
  'latin grammy',
  'brit awards',
  'amas',
  'snl',
  'snl uk',
  'saturday night live',
  'fallon',
  'the tonight show',
  'kimmel',
  'colbert',
  'netflix',
  'disney+',
  'prime video',
  'hbo',
  'spotify',
  'apple music',
  'tiktok',
  'youtube',
  'instagram',
  'billboard',
  'coachella',
  'glastonbury',
  'lollapalooza',
]);

/** Tags that mark non-music culture coverage. */
const OFF_TOPIC_TAGS = foldAll([
  'cine',
  'cine y tv',
  'series',
  'películas',
  'libros',
  'tv',
  'gaming',
  'moda',
  'film',
  'movies',
  'television',
  'books',
]);

/** Verbs that typically end the subject ("<Artist> Announce ..."). */
const SUBJECT_ENDING_VERBS = new Set(
  (
    'announce announces announced share shares shared release releases released ' +
    'return returns reunite reunites cancel cancels cancelled canceled confirm ' +
    'confirms drop drops dropped unveil unveils die dies died welcome welcomes ' +
    'post posts debut debuts tease teases teased cover covers covered join joins ' +
    'perform performs performed play plays played premiere premieres detail ' +
    'details add adds expand expands postpone postpones reschedule reschedules ' +
    'sign signs win wins won lead leads top tops break breaks pay pays plan plans ' +
    'receive receives make makes honor honors honour honours dedicate dedicates ' +
    'celebrate celebrates unvault unvaults unearth unearths sell sells sold ' +
    'bring brings sing sings showcase showcases size sizes rule rules accept ' +
    'accepts roast roasted get gets go goes set sets team teams ' +
    'have has are is was were will to on at for in ' +
    'anuncia anuncian anuncio vuelve vuelven lanza lanzan lanzo estrena estrenan ' +
    'estreno confirma confirman confirmo publica publican comparte comparten ' +
    'regresa regresan murio fallecio suma suman presenta presentan llega llegan ' +
    'tocara tocaran cerro cierra se le en'
  ).split(' '),
);

/** Lowercase words allowed inside a name ("Florence and the Machine", "Hijos de la Tierra"). */
const NAME_CONNECTORS = new Set(
  'of the and de del la los las y el da di van von'.split(' '),
);

const TITLE_PREFIXES =
  /^(watch|listen|hear|stream|video|premiere|exclusive|mira|escucha)\s*[:-]?\s+/i;

/** Titles opening with these don't start with their subject ("As X's album turns 50"). */
const NON_SUBJECT_OPENERS = new Set(
  (
    'as after before how why when what where while here heres if ' +
    'would could should can do does did is are'
  ).split(' '),
);

const MAX_SUBJECT_WORDS = 5;

function uniqueByKey(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = artistKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

function bareWord(word: string): string {
  return fold(word).replace(/[^a-z]/g, '');
}

/**
 * "<Name>'s ..." or "<Name> announce ..." → Name(s). The subject is the
 * leading run of capitalised words, so sentence-case Spanish titles
 * ("Un fan le regaló ...") stop at the first lowercase word.
 */
function artistsFromTitlePrefix(title: string): string[] {
  const words = title.replace(TITLE_PREFIXES, '').split(/\s+/);
  if (NON_SUBJECT_OPENERS.has(bareWord(words[0] ?? ''))) return [];

  const subject: string[] = [];

  for (const word of words) {
    if (subject.length > MAX_SUBJECT_WORDS) break;

    // "VMAs 2026: Taylor Swift ..." - a section label, the subject follows it.
    if (word.endsWith(':')) {
      subject.length = 0;
      continue;
    }

    const possessive = word.match(/^(.+?)['’]s$/);
    if (possessive) {
      subject.push(possessive[1]);
      break;
    }
    if (SUBJECT_ENDING_VERBS.has(bareWord(word))) break;

    const startsLower = /^\p{Ll}/u.test(word);
    if (startsLower && !NAME_CONNECTORS.has(fold(word))) break;

    subject.push(word);
  }

  if (subject.length === 0 || subject.length > MAX_SUBJECT_WORDS) return [];
  return splitNames(subject.join(' '));
}

function splitNames(subject: string): string[] {
  return subject
    .replace(/[,:;]+$/, '')
    .split(/\s*(?:,|&|\band\b|\by\b|\bwith\b|\bcon\b)\s*/i)
    .map((name) => name.trim().replace(/[,:;]+$/, ''))
    .filter(
      (name) =>
        /^[\p{Lu}\d]/u.test(name) &&
        name.length > 1 &&
        !/^\d+$/.test(name) &&
        // "Los 5", "The 10", "Would You": no word of it is a name.
        !name
          .split(/\s+/)
          .every((word) => isStopword(word) || /^\d+$/.test(word)),
    );
}

function isNonArtistTag(folded: string): boolean {
  return (
    GENERIC_TAGS.has(folded) ||
    EVENT_AND_PLATFORM_TAGS.has(folded) ||
    OFF_TOPIC_TAGS.has(folded)
  );
}

/**
 * Artists named by the item. Outlet tags that also appear in the title are
 * the most precise signal; the title's grammatical subject is the fallback.
 */
export function extractArtists(title: string, tags: string[] = []): string[] {
  const foldedTitle = fold(title);
  const fromTags = tags.filter((tag) => {
    const folded = fold(tag);
    return (
      folded.length > 1 &&
      !isNonArtistTag(folded) &&
      containsPhrase(foldedTitle, folded)
    );
  });
  const tagKeys = fromTags.map(artistKey);

  // A subject that merely wraps a tagged artist ("Taylor Swift Pays Tribute",
  // "Living Members of Nirvana") is a parsing overrun, not a second artist.
  const fromSubject = artistsFromTitlePrefix(title).filter((name) => {
    const key = artistKey(name);
    return (
      !EVENT_AND_PLATFORM_TAGS.has(fold(name)) &&
      !tagKeys.some((tagKey) => key !== tagKey && containsPhrase(key, tagKey))
    );
  });

  // Order by first appearance in the title, so artists[0] is the protagonist.
  const position = (name: string) => {
    const index = foldedTitle.indexOf(fold(name));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return uniqueByKey([...fromTags, ...fromSubject]).sort(
    (a, b) => position(a) - position(b),
  );
}

/** Ordered: the first matching rule wins, most specific first. */
const STORY_TYPE_RULES: [StoryType, RegExp][] = [
  [
    StoryType.DEATH,
    /\b(dies|died|dead at|passes away|passed away|muere|murio|fallecio|fallece)\b/,
  ],
  [StoryType.REUNION, /\b(reunite|reunites|reunited|reunion|se reunen)\b/],
  [
    StoryType.FESTIVAL,
    /\b(festival|lineup|line-up|lollapalooza|coachella|glastonbury|primavera sound|cosquin)\b/,
  ],
  [
    StoryType.TOUR,
    /\b(tour|tours|tour dates|gira|world tour|residency|shows in|sold out|sells out|sell out)\b/,
  ],
  [
    StoryType.AWARD,
    /\b(award|awards|grammy|grammys|nominated|nominees|nomination|hall of fame|inducted|premio|premios|nominados|gardel)\b/,
  ],
  [
    StoryType.CHART,
    /\b(chart|charts|billboard 200|hot 100|no\. 1|number one|number 1|debuts at|streaming records?|record-breaking|ranking)\b/,
  ],
  [
    StoryType.CONTROVERSY,
    /\b(lawsuit|sues|sued|slams|controversy|backlash|accused|accuses|arrested|feud|cancelled|canceled|polemica|denuncia|cancela)\b/,
  ],
  [
    StoryType.COLLABORATION,
    /\b(collab|collaboration|collaborate|team up|teams up|join forces|featuring|feat\.|colaboracion|junto a)\b/,
  ],
  [
    StoryType.MUSIC_VIDEO,
    /\b(music video|video for|videoclip|official video|nuevo video)\b/,
  ],
  [
    StoryType.ALBUM,
    /\b(album|albums|lp|ep|disco|nuevo disco|deluxe|tracklist|reissue)\b/,
  ],
  [
    StoryType.SINGLE,
    /\b(single|new song|songs?|tracks?|cancion|canciones|tema|nuevo tema|nueva cancion)\b/,
  ],
  [
    StoryType.NEW_RELEASE,
    /\b(releases?|released|surprise-releases?|unreleased|unvaults?|unearths?|out now|estrena|lanza|lanzamiento)\b/,
  ],
  [
    StoryType.CONCERT,
    /\b(concert|live|onstage|on stage|performs?|performed|performing|performance|sings?|show|setlist|recital|en vivo|en concierto)\b/,
  ],
  [
    StoryType.INTERVIEW,
    /\b(interview|talks|opens up|reflects|entrevista|charla|hablo)\b/,
  ],
  [StoryType.VIRAL, /\b(viral|goes viral|tiktok trend|meme)\b/],
  [
    StoryType.ANNOUNCEMENT,
    /\b(announce|announces|announced|confirms|confirmed|reveals|anuncia|anuncio|confirma|revela)\b/,
  ],
];

export function classifyStoryType(title: string): StoryType {
  const text = fold(title);
  const match = STORY_TYPE_RULES.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : StoryType.OTHER;
}

const RUMOR_PATTERN =
  /\b(rumou?rs?|rumou?red|reportedly|allegedly|speculation|could be|may be|teases? possible|se rumorea|rumores|habria|podria)\b/;

export function isRumor(title: string): boolean {
  return RUMOR_PATTERN.test(fold(title));
}

/** Ordered so "post-punk" is claimed before plain "punk". */
const GENRE_RULES: [Genre, RegExp][] = [
  [Genre.POST_PUNK, /\bpost[- ]punk\b/],
  [
    Genre.METAL,
    /\b(metal|metalcore|deathcore|thrash|doom|black metal|heavy metal)\b/,
  ],
  [Genre.PUNK, /(^|[^-])\bpunk\b/],
  [Genre.HIP_HOP, /\b(hip[- ]hop|rap|rapper|rappers|drill)\b/],
  [
    Genre.LATIN,
    /\b(latin|latino|latina|reggaeton|cumbia|bachata|salsa|urbano|trap latino)\b/,
  ],
  [Genre.ELECTRONIC, /\b(electronic|edm|techno|dj|electronica)\b/],
  [Genre.PROG, /\b(prog|progressive|progresivo)\b/],
  [Genre.ALTERNATIVE, /\b(alternative|alt-rock|grunge|alternativo)\b/],
  [Genre.INDIE, /\bindie\b/],
  [Genre.POP, /\b(pop|k-pop)\b/],
  [Genre.ROCK, /\b(rock|rocker|rockers)\b/],
];

export function detectGenres(title: string, tags: string[] = []): Genre[] {
  const text = fold([title, ...tags].join(' | '));
  return GENRE_RULES.filter(([, pattern]) => pattern.test(text)).map(
    ([genre]) => genre,
  );
}

export function isOffTopic(tags: string[] = []): boolean {
  return tags.some((tag) => OFF_TOPIC_TAGS.has(fold(tag)));
}

export function analyzeItem(item: NormalizedItem): AnalyzedItem {
  const tags = item.tags ?? [];
  const artists = extractArtists(item.title, tags);

  return {
    ...item,
    artists,
    artistKeys: artists.map(artistKey),
    storyType: classifyStoryType(item.title),
    genres: detectGenres(item.title, tags),
    sourceGenres: findNewsSource(item.source)?.genres ?? [],
    rumor: isRumor(item.title),
    offTopic: isOffTopic(tags),
    keywords: keywords(item.title),
  };
}
