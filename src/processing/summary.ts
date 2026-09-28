import { fold } from './text';

/** Short enough for a card, long enough for one or two sentences. */
export const MAX_SUMMARY_LENGTH = 240;
/** Below this, what's left after cleanup isn't worth showing. */
const MIN_SUMMARY_LENGTH = 40;

/** Feed boilerplate appended after the actual standfirst. */
const BOILERPLATE_MARKERS = [
  /\s*The post\b[\s\S]*$/, // WordPress: "The post <title> appeared first on <site>."
  /\s*Continue reading[\s\S]*$/i,
  /\s*Read more[\s\S]*$/i,
  /\s*Seguir leyendo[\s\S]*$/i,
  /\s*\[(…|\.\.\.)\]\s*$/,
];

/**
 * Turns an RSS standfirst into a short, clean summary, or `undefined` if
 * nothing usable remains. Pure text cleanup - the stand-in for the AI
 * editor's summary (spec 20), which this project doesn't use.
 */
export function cleanSummary(
  description: string | undefined,
  headlines: string[] = [],
): string | undefined {
  if (!description) return undefined;

  let text = description.replace(/\s+/g, ' ').trim();
  for (const marker of BOILERPLATE_MARKERS) {
    text = text.replace(marker, '');
  }

  // Some feeds (Consequence) append a related headline + byline; cut from
  // the first headline found onwards.
  const folded = fold(text);
  for (const headline of headlines) {
    const index = folded.indexOf(fold(headline));
    if (index > 0) text = text.slice(0, index);
  }

  text = truncate(
    text
      .trim()
      .replace(/(\.\.\.|…)$/, '')
      .trim(),
  );
  return text.length >= MIN_SUMMARY_LENGTH ? text : undefined;
}

/** Cut at the last full sentence that fits; else at a word, with an ellipsis. */
function truncate(text: string): string {
  if (text.length <= MAX_SUMMARY_LENGTH) return text;

  const window = text.slice(0, MAX_SUMMARY_LENGTH);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (sentenceEnd >= MIN_SUMMARY_LENGTH) {
    return window.slice(0, sentenceEnd + 1);
  }

  const wordEnd = window.lastIndexOf(' ');
  return `${window.slice(0, wordEnd > 0 ? wordEnd : MAX_SUMMARY_LENGTH).replace(/[,;:]$/, '')}…`;
}
