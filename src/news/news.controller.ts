import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Genre } from '../common/enums/genre.enum';
import { Region } from '../common/enums/region.enum';
import { TopStoriesSnapshot } from '../common/interfaces/top-story.interface';
import { AppConfig } from '../config/configuration';
import { PipelineService } from '../pipeline/pipeline.service';
import { TrendStoreService } from '../redis/trend-store.service';
import { filterStories } from '../trends/ranking';

function parseEnum<T extends Record<string, string>>(
  values: T,
  raw: string | undefined,
  name: string,
): T[keyof T] | undefined {
  if (!raw) return undefined;
  const value = raw.toUpperCase().replace(/[- ]/g, '_');
  if (!Object.values(values).includes(value)) {
    throw new BadRequestException(
      `Unknown ${name} "${raw}". Use one of: ${Object.values(values)
        .map((v) => v.toLowerCase())
        .join(', ')}`,
    );
  }
  return value as T[keyof T];
}

const EMPTY: TopStoriesSnapshot = { generatedAt: null, stories: [] };

@Controller('api')
export class NewsController {
  constructor(
    private readonly trendStore: TrendStoreService,
    private readonly pipeline: PipelineService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** GET /api/news/top?region=argentina&genre=rock (spec 27). */
  @Get('news/top')
  async top(
    @Query('region') region?: string,
    @Query('genre') genre?: string,
  ): Promise<TopStoriesSnapshot> {
    const filter = {
      region: parseEnum(Region, region, 'region'),
      genre: parseEnum(Genre, genre, 'genre'),
    };
    const snapshot = (await this.trendStore.getTopStories()) ?? EMPTY;

    return {
      generatedAt: snapshot.generatedAt,
      stories: filterStories(
        snapshot.stories,
        filter,
        this.config.get('topNewsLimit', { infer: true }),
      ),
    };
  }

  /** Every ranked candidate, not just the Top N. */
  @Get('trends')
  async trends(): Promise<TopStoriesSnapshot> {
    return (await this.trendStore.getTopStories()) ?? EMPTY;
  }

  /** Runs the pipeline now and returns the new global Top N. */
  @Post('news/refresh')
  @HttpCode(200)
  async refresh(): Promise<TopStoriesSnapshot> {
    const { snapshot } = await this.pipeline.run();
    return {
      generatedAt: snapshot.generatedAt,
      stories: snapshot.stories.slice(
        0,
        this.config.get('topNewsLimit', { infer: true }),
      ),
    };
  }
}
