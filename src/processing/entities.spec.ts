import { Genre } from '../common/enums/genre.enum';
import { StoryType } from '../common/enums/story-type.enum';
import {
  classifyStoryType,
  detectGenres,
  extractArtists,
  isOffTopic,
  isRumor,
} from './entities';

describe('extractArtists', () => {
  it('takes the subject before the verb in title-case headlines', () => {
    expect(extractArtists('Slipknot Announce 2027 Stadium Tour')).toEqual([
      'Slipknot',
    ]);
    expect(extractArtists('John Mayer Will Return to the Sphere')).toEqual([
      'John Mayer',
    ]);
  });

  it('reads possessives and joined names', () => {
    expect(extractArtists('U2’s new album features a surprise')).toEqual([
      'U2',
    ]);
    expect(
      extractArtists('Kneecap and Tom Morello have shared new collaboration'),
    ).toEqual(['Kneecap', 'Tom Morello']);
  });

  it('prefers outlet tags found in the title and orders by position', () => {
    expect(
      extractArtists('Un fan le regaló una guitarra a Bruce Springsteen', [
        'Historias',
        'Bruce Springsteen',
      ]),
    ).toEqual(['Bruce Springsteen']);
  });

  it('ignores events, platforms and section labels', () => {
    expect(
      extractArtists('VMAs 2026: Nirvana Receive The Video Vanguard Award', [
        'VMAs',
        'Nirvana',
      ]),
    ).toEqual(['Nirvana']);
    expect(
      extractArtists('Qué ver en Netflix: 4 películas', ['Netflix']),
    ).toEqual([]);
  });

  it('does not treat sentence-case Spanish subjects or questions as names', () => {
    expect(extractArtists('Los 5 discos de folk favoritos')).toEqual([]);
    expect(extractArtists('Would You Drop $500 on a Briefcase?')).toEqual([]);
  });

  it('drops a subject that only overruns a tagged artist', () => {
    expect(
      extractArtists('Taylor Swift Pays Tribute to Dolly Parton', [
        'Taylor Swift',
        'Dolly Parton',
      ]),
    ).toEqual(['Taylor Swift', 'Dolly Parton']);
  });
});

describe('classifyStoryType', () => {
  it.each([
    ['Slipknot Announce 2027 Stadium Tour', StoryType.TOUR],
    ['Chuck Varga, GWAR’s Sexecutioner, Dead At 68', StoryType.DEATH],
    ['Living Members of Nirvana Reunite to Accept Award', StoryType.REUNION],
    ['Ghostemane has announced new album ‘AM:FM’', StoryType.ALBUM],
    ['Lali cerró en River la gira', StoryType.TOUR],
    ['Stevie Wonder Unearths Four Rarities', StoryType.NEW_RELEASE],
    ['Band confirms something', StoryType.ANNOUNCEMENT],
    ['Billy Joel’s Motorcycle Collection', StoryType.OTHER],
  ])('%s → %s', (title, type) => {
    expect(classifyStoryType(title)).toBe(type);
  });
});

describe('detectGenres', () => {
  it('reads genres from title and tags', () => {
    expect(detectGenres('New thrash record', ['Heavy Metal'])).toEqual([
      Genre.METAL,
    ]);
    expect(detectGenres('A post-punk revival')).toEqual([Genre.POST_PUNK]);
  });

  it('returns nothing without a signal (source defaults apply later)', () => {
    expect(detectGenres('Band announces tour')).toEqual([]);
  });
});

describe('isRumor / isOffTopic', () => {
  it('flags rumor wording in English and Spanish', () => {
    expect(isRumor('Band reportedly splitting up')).toBe(true);
    expect(isRumor('Se rumorea una reunión')).toBe(true);
    expect(isRumor('Band announces tour')).toBe(false);
  });

  it('flags film/series/books coverage', () => {
    expect(isOffTopic(['Cine', 'Netflix'])).toBe(true);
    expect(isOffTopic(['Shows', 'SLIPKNOT'])).toBe(false);
  });
});
