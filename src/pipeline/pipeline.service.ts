import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TopStoriesSnapshot } from '../common/interfaces/top-story.interface';
import { AppConfig } from '../config/configuration';
import { scoringWeights } from '../config/scoring-weights';
import { clusterItems } from '../processing/clustering';
import { analyzeItem } from '../processing/entities';
import { normalizeItems } from '../processing/normalize';
import { TrendStoreService } from '../redis/trend-store.service';
import {
  CollectorService,
  SourceRunResult,
} from '../sources/collector.service';
import { rankStories } from '../trends/ranking';
import { buildArtistGenreIndex, buildStory } from '../trends/story-builder';

/**
 * How many ranked stories the snapshot keeps. More than the Top N so a
 * regional or genre filter still has enough candidates to fill its own top.
 */
const RANKING_CANDIDATES = 60;

export interface PipelineRunResult {
  snapshot: TopStoriesSnapshot;
  sources: SourceRunResult[];
}

/**
 * The whole first-milestone pipeline (spec 39): collection → normalization →
 * entity detection → clustering → trend scoring → ranking. Raw items live only
 * in memory for the duration of a run; only the ranked snapshot and velocity
 * samples reach Redis, both with TTL.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private inFlight: Promise<PipelineRunResult> | null = null;

  constructor(
    private readonly collector: CollectorService,
    private readonly trendStore: TrendStoreService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Concurrent callers (scheduler + manual refresh) share one run. */
  run(): Promise<PipelineRunResult> {
    this.inFlight ??= this.execute().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async execute(): Promise<PipelineRunResult> {
    const now = new Date();
    const maxAgeHours = this.config.get('news.maxAgeHours', { infer: true });

    this.logger.log('Collection started');
    const collection = await this.collector.collect();
    const failed = collection.sources.filter((source) => !source.ok);
    this.logger.log(
      `Collection completed: ${collection.items.length} items from ` +
        `${collection.sources.length - failed.length}/${collection.sources.length} sources`,
    );

    const { items, discarded } = normalizeItems(collection.items, {
      now,
      maxAgeHours,
    });
    this.logger.log(`${items.length} valid items (${discarded} discarded)`);

    const analyzed = items.map(analyzeItem).filter((item) => !item.offTopic);
    if (analyzed.length < items.length) {
      this.logger.log(
        `${items.length - analyzed.length} off-topic items discarded`,
      );
    }
    const clusters = clusterItems(analyzed, { windowHours: maxAgeHours });
    this.logger.log(
      `${clusters.length} stories detected (${analyzed.length - clusters.length} duplicate items merged)`,
    );

    const artistGenres = buildArtistGenreIndex(analyzed);
    const velocities = await this.trendStore.recordSamplesAndVelocities(
      clusters.map((cluster) => ({
        topic: cluster.id,
        mentions: new Set(cluster.items.map((item) => item.source)).size,
      })),
      now.getTime(),
    );
    const stories = clusters.map((cluster) =>
      buildStory(
        cluster,
        velocities.get(cluster.id) ?? 0,
        now,
        scoringWeights,
        artistGenres,
      ),
    );

    const snapshot: TopStoriesSnapshot = {
      generatedAt: now.toISOString(),
      stories: rankStories(stories, RANKING_CANDIDATES),
    };
    await this.trendStore.setTopStories(snapshot);
    this.logger.log(
      `Ranking completed: top ${Math.min(
        this.config.get('topNewsLimit', { infer: true }),
        snapshot.stories.length,
      )} of ${stories.length} stories`,
    );

    return { snapshot, sources: collection.sources };
  }
}
