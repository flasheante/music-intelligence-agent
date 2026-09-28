import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';
import { StoryType } from '../common/enums/story-type.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { scoringWeights } from '../config/scoring-weights';
import { clusterItems } from '../processing/clustering';
import { analyzeItem } from '../processing/entities';
import { filterStories, rankStories } from './ranking';
import {
  buildArtistGenreIndex,
  buildStory,
  consensusItem,
} from './story-builder';

const now = new Date('2026-09-28T12:00:00Z');

function item(
  source: string,
  region: Region,
  title: string,
  tags: string[] = [],
) {
  return analyzeItem({
    source,
    sourceType: 'news',
    title,
    url: `https://example.com/${source.replace(/\W/g, '')}/${title.length}`,
    publishedAt: new Date('2026-09-28T10:00:00Z'),
    region,
    tags,
  });
}

describe('buildStory', () => {
  const [cluster] = clusterItems(
    [
      item('Loudwire', Region.USA, 'Slipknot Announce 2027 Stadium Tour'),
      item(
        'Rolling Stone',
        Region.USA,
        'Slipknot Plan (Sic)est Stadium Tour for Summer 2027',
      ),
      item('NME', Region.EUROPE, 'Slipknot announce 2027 stadium tour'),
      item(
        'Billboard Argentina',
        Region.ARGENTINA,
        'Slipknot vuelve a la Argentina',
        ['SLIPKNOT'],
      ),
    ],
    { windowHours: 48 },
  );
  const story = buildStory(cluster, 0.5, now, scoringWeights);

  it('uses the consensus headline, authority breaking the tie', () => {
    // Loudwire and NME say the same thing; the rest agree less with both.
    expect(story.title).toBe('Slipknot announce 2027 stadium tour');
  });

  it('lists one link per outlet, most authoritative first', () => {
    expect(story.sources[0].name).toBe('Rolling Stone');
    expect(story.sourceCount).toBe(4);
  });

  it('aggregates regions, artists, type and verification', () => {
    expect(story.regions.sort()).toEqual([
      Region.ARGENTINA,
      Region.EUROPE,
      Region.USA,
    ]);
    expect(story.artists).toEqual(['Slipknot']);
    expect(story.type).toBe(StoryType.TOUR);
    expect(story.verificationStatus).toBe(VerificationStatus.CONFIRMED);
    expect(story.score).toBeGreaterThan(7);
  });

  it('falls back to the outlets’ default genres only when coverage has none', () => {
    expect(story.genres).toEqual([Genre.METAL, Genre.ROCK]);
  });
});

describe('buildStory genres and summary', () => {
  function single(source: string, title: string, description?: string) {
    const [cluster] = clusterItems(
      [{ ...item(source, Region.EUROPE, title), description }],
      { windowHours: 48 },
    );
    return cluster;
  }

  it('borrows genres from other coverage of the same artist before outlet defaults', () => {
    const elsewhere = item(
      'Billboard',
      Region.USA,
      'KATSEYE top the pop chart',
    );
    const index = buildArtistGenreIndex([elsewhere]);

    const story = buildStory(
      single('Dork', 'KATSEYE have joined an SNL sketch'),
      0,
      now,
      scoringWeights,
      index,
    );

    expect(story.genres).toEqual([Genre.POP]);
  });

  it('summarises from the cleaned feed standfirst', () => {
    const story = buildStory(
      single(
        'NME',
        'Placebo share new single',
        'The track takes its cue from a hidden 1996 instrumental. The post Placebo share new single appeared first on NME.',
      ),
      0,
      now,
      scoringWeights,
    );

    expect(story.summary).toBe(
      'The track takes its cue from a hidden 1996 instrumental.',
    );
  });
});

describe('consensusItem', () => {
  it('prefers the headline most outlets agree with over a side angle', () => {
    const sideAngle = item(
      'Rolling Stone',
      Region.USA,
      'Madonna’s Danceteria Was One of the Great Moments in VMAs History',
    );
    const items = [
      sideAngle,
      item(
        'Stereogum',
        Region.USA,
        'Madonna opens VMAs performance joined by Sabrina Carpenter',
      ),
      item(
        'Consequence',
        Region.USA,
        'Madonna VMAs performance featured Sabrina Carpenter',
      ),
      item(
        'Pitchfork',
        Region.USA,
        'Madonna brings out Sabrina Carpenter at the VMAs',
      ),
    ];

    expect(consensusItem(items).source).toBe('Consequence');
  });
});

describe('rankStories / filterStories', () => {
  const stories = rankStories(
    [
      {
        id: 'low',
        score: 3,
        sourceCount: 1,
        lastSeenAt: 'a',
        regions: [Region.USA],
        genres: [Genre.POP],
      },
      {
        id: 'high',
        score: 8,
        sourceCount: 5,
        lastSeenAt: 'a',
        regions: [Region.ARGENTINA],
        genres: [Genre.ROCK],
      },
      {
        id: 'mid',
        score: 5,
        sourceCount: 2,
        lastSeenAt: 'a',
        regions: [Region.USA, Region.ARGENTINA],
        genres: [Genre.ROCK],
      },
    ] as never,
    10,
  );

  it('orders by score and numbers ranks', () => {
    expect(stories.map((s) => [s.rank, s.id])).toEqual([
      [1, 'high'],
      [2, 'mid'],
      [3, 'low'],
    ]);
  });

  it('filters by region and genre and re-numbers ranks', () => {
    expect(
      filterStories(stories, { region: Region.USA }, 10).map((s) => [
        s.rank,
        s.id,
      ]),
    ).toEqual([
      [1, 'mid'],
      [2, 'low'],
    ]);
    expect(
      filterStories(stories, { genre: Genre.ROCK }, 1).map((s) => s.id),
    ).toEqual(['high']);
  });
});
