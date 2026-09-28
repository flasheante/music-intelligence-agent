import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { PipelineService } from '../pipeline/pipeline.service';
import { TrendStoreService } from '../redis/trend-store.service';
import { NewsController } from './news.controller';

const stories = [
  { rank: 1, id: 'a', regions: ['USA'], genres: ['POP'] },
  { rank: 2, id: 'b', regions: ['ARGENTINA'], genres: ['ROCK'] },
  { rank: 3, id: 'c', regions: ['EUROPE', 'ARGENTINA'], genres: ['METAL'] },
];

function controller(snapshot: unknown, limit = 10) {
  const trendStore = {
    getTopStories: jest.fn().mockResolvedValue(snapshot),
  } as unknown as TrendStoreService;
  const pipeline = {
    run: jest.fn().mockResolvedValue({ snapshot, sources: [] }),
  } as unknown as PipelineService;
  const config = { get: () => limit } as unknown as ConfigService<
    AppConfig,
    true
  >;
  return new NewsController(trendStore, pipeline, config);
}

describe('NewsController', () => {
  const snapshot = { generatedAt: '2026-09-28T12:00:00.000Z', stories };

  it('returns the global top N', async () => {
    const result = await controller(snapshot, 2).top();
    expect(result.stories.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('filters by lowercase region and genre, re-ranking within the view', async () => {
    const byRegion = await controller(snapshot).top('argentina');
    expect(byRegion.stories.map((s) => [s.rank, s.id])).toEqual([
      [1, 'b'],
      [2, 'c'],
    ]);

    const byGenre = await controller(snapshot).top(undefined, 'metal');
    expect(byGenre.stories.map((s) => s.id)).toEqual(['c']);
  });

  it('rejects unknown filters', async () => {
    await expect(controller(snapshot).top('mars')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns an empty ranking before the first run', async () => {
    expect(await controller(null).top()).toEqual({
      generatedAt: null,
      stories: [],
    });
  });

  it('refresh runs the pipeline and returns the top N', async () => {
    const result = await controller(snapshot, 1).refresh();
    expect(result.stories.map((s) => s.id)).toEqual(['a']);
  });
});
