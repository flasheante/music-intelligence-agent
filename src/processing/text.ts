const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return HTML_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/** Lowercase, accent-free, straight quotes: the form every comparison uses. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

const STOPWORDS = new Set(
  // English
  (
    'the a an and or of to in on at for with from by as is are was were be ' +
    'this that these those it its his her their they them he she we you i ' +
    'new after before over into about out up has have had will just more ' +
    'watch listen hear see how why what who when first latest here ' +
    // Spanish
    'el la los las un una unos unas y o de del al en con por para que se su ' +
    'sus es son fue mas como tras sobre nuevo nueva lo le les mira escucha'
  ).split(' '),
);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(fold(word));
}

/** Significant words of a title, for keyword similarity. */
export function keywords(text: string): string[] {
  return fold(text)
    .replace(/'s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const word of setA) {
    if (setB.has(word)) shared++;
  }
  return shared / (setA.size + setB.size - shared);
}

export function slugify(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Canonical key for an artist name: "The Rolling Stones" ≈ "rolling stones". */
export function artistKey(name: string): string {
  return fold(name)
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
