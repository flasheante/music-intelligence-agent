import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AppConfig } from '../config/configuration';
import { QUEUE_NAMES } from '../queues/queue-names';
import { TrendStoreService } from '../redis/trend-store.service';
import { PipelineService } from './pipeline.service';

export const FULL_RUN_JOB = 'full-run';
const SCHEDULER_ID = 'news-pipeline';

/**
 * For the first milestone every stage runs inside one job on the
 * source-collection queue: news volume is small enough that splitting the
 * stages across queues (spec 25) would add hand-offs without benefit yet.
 */
@Processor(QUEUE_NAMES.SOURCE_COLLECTION)
export class PipelineProcessor extends WorkerHost {
  constructor(private readonly pipeline: PipelineService) {
    super();
  }

  async process(): Promise<void> {
    await this.pipeline.run();
  }
}

/** Repeats the pipeline every NEWS_INTERVAL_MINUTES (spec 26). */
@Injectable()
export class PipelineScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(PipelineScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SOURCE_COLLECTION) private readonly queue: Queue,
    private readonly trendStore: TrendStoreService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const minutes = this.config.get('intervals.newsMinutes', { infer: true });

    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: minutes * 60_000 },
      { name: FULL_RUN_JOB, opts: { removeOnComplete: 50, removeOnFail: 50 } },
    );
    this.logger.log(`News pipeline scheduled every ${minutes} min`);

    // Don't leave the API empty until the first interval elapses.
    if (!(await this.trendStore.getTopStories())) {
      await this.queue.add(FULL_RUN_JOB, {}, { removeOnComplete: true });
    }
  }
}
