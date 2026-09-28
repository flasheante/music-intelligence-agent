import { cleanSummary, MAX_SUMMARY_LENGTH } from './summary';

describe('cleanSummary', () => {
  it('strips WordPress and "continue reading" boilerplate', () => {
    expect(
      cleanSummary(
        'The track takes its cue from a hidden 1996 instrumental. The post Check out the new single appeared first on NME.',
      ),
    ).toBe('The track takes its cue from a hidden 1996 instrumental.');
    expect(
      cleanSummary(
        "GWAR share that Varga was 'an unforgettable presence' in the early years. Continue reading…",
      ),
    ).toBe(
      "GWAR share that Varga was 'an unforgettable presence' in the early years.",
    );
  });

  it('cuts an appended related headline and byline', () => {
    expect(
      cleanSummary(
        'The tour will be phone-free and include a setlist decided by fans. Brandi Carlile Announces 2026 Tour Paolo Ragusa',
        ['Brandi Carlile Announces 2026 Tour'],
      ),
    ).toBe(
      'The tour will be phone-free and include a setlist decided by fans.',
    );
  });

  it('truncates at a sentence boundary when possible, else at a word', () => {
    const sentences = `${'A first sentence that is long enough. '.repeat(8)}`;
    const result = cleanSummary(sentences)!;
    expect(result.length).toBeLessThanOrEqual(MAX_SUMMARY_LENGTH);
    expect(result.endsWith('.')).toBe(true);

    const oneLongSentence = `${'word '.repeat(80)}end`;
    const cut = cleanSummary(oneLongSentence)!;
    expect(cut.endsWith('word…')).toBe(true);
  });

  it('drops summaries too short to be useful', () => {
    expect(cleanSummary('Out now.')).toBeUndefined();
    expect(cleanSummary(undefined)).toBeUndefined();
  });
});
