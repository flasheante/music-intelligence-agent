import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { TopStoriesSnapshot } from '../common/interfaces/top-story.interface';
import { REDIS_CLIENT } from './redis.constants';

const TOP_STORIES_KEY = 'music:top';

function trendKey(topic: string): string {
  return `music:trend:${topic}`;
}

function samplesKey(topic: string): string {
  return `music:trend:${topic}:samples`;
}

function seenKey(urlHash: string): string {
  return `music:seen:${urlHash}`;
}

export interface TrendSample {
  timestamp: number;
  mentions: number;
}

function parseSamples(raw: string[]): TrendSample[] {
  return raw.map((entry) => {
    const [timestamp, mentions] = entry.split(':');
    return { timestamp: Number(timestamp), mentions: Number(mentions) };
  });
}

function velocityOf(samples: TrendSample[]): number {
  if (samples.length < 2) return 0;

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first.mentions <= 0) return 0;

  return (last.mentions - first.mentions) / first.mentions;
}

type PipelineResults = Awaited<
  ReturnType<ReturnType<Redis['pipeline']>['exec']>
>;

/** ioredis pipelines report per-command errors in-band; surface the first. */
function throwOnPipelineError(
  results: PipelineResults,
): [Error | null, unknown][] {
  if (!results) throw new Error('Redis pipeline was aborted');
  const failed = results.find(([error]) => error);
  if (failed?.[0]) throw failed[0];
  return results;
}

/**
 * Owns the Redis-key shapes the trend engine depends on:
 *  - a sorted set of timestamped mention-count samples per topic, used to
 *    derive velocity (see spec section 15) instead of a single overwritten value
 *  - a short-TTL dedup marker per item URL hash, so re-polled RSS/YouTube items
 *    don't get recounted as new mentions on every collection cycle
 *  - the latest published Top N snapshot, overwritten on every ranking run
 */
@Injectable()
export class TrendStoreService {
  private readonly trendTtlSeconds: number;
  private readonly seenTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<AppConfig, true>,
  ) {
    this.trendTtlSeconds = config.get('trend.ttlHours', { infer: true }) * 3600;
    this.seenTtlSeconds =
      config.get('trend.seenItemTtlHours', { infer: true }) * 3600;
  }

  async recordSample(
    topic: string,
    mentions: number,
    timestamp: number = Date.now(),
  ): Promise<void> {
    const key = samplesKey(topic);
    await this.redis
      .multi()
      .zadd(key, timestamp, `${timestamp}:${mentions}`)
      .expire(key, this.trendTtlSeconds)
      .exec();
  }

  async getSamples(topic: string): Promise<TrendSample[]> {
    return parseSamples(await this.redis.zrange(samplesKey(topic), '0', '-1'));
  }

  /**
   * Growth rate between the oldest and newest recorded sample, e.g. 0.82 for +82%.
   * Returns 0 when there isn't enough history yet.
   */
  async computeVelocity(topic: string): Promise<number> {
    return velocityOf(await this.getSamples(topic));
  }

  /**
   * Records one sample per topic and returns every topic's velocity, in two
   * pipelined round trips. A pipeline run touches ~100 topics; issuing them
   * as ~200 concurrent transactions gets the connection reset by hosted
   * Redis proxies such as Upstash.
   */
  async recordSamplesAndVelocities(
    samples: { topic: string; mentions: number }[],
    timestamp: number = Date.now(),
  ): Promise<Map<string, number>> {
    const writes = this.redis.pipeline();
    for (const { topic, mentions } of samples) {
      const key = samplesKey(topic);
      writes
        .zadd(key, timestamp, `${timestamp}:${mentions}`)
        .expire(key, this.trendTtlSeconds);
    }
    throwOnPipelineError(await writes.exec());

    const reads = this.redis.pipeline();
    for (const { topic } of samples) {
      reads.zrange(samplesKey(topic), '0', '-1');
    }
    const results = throwOnPipelineError(await reads.exec());

    return new Map(
      samples.map(({ topic }, index) => [
        topic,
        velocityOf(parseSamples(results[index][1] as string[])),
      ]),
    );
  }

  async setScore(topic: string, score: Record<string, unknown>): Promise<void> {
    const key = trendKey(topic);
    await this.redis
      .multi()
      .set(key, JSON.stringify(score))
      .expire(key, this.trendTtlSeconds)
      .exec();
  }

  async getScore<T = Record<string, unknown>>(
    topic: string,
  ): Promise<T | null> {
    const value = await this.redis.get(trendKey(topic));
    return value ? (JSON.parse(value) as T) : null;
  }

  /** Returns true if this is the first time urlHash has been seen within the TTL window. */
  async markSeenIfNew(urlHash: string): Promise<boolean> {
    const result = await this.redis.set(
      seenKey(urlHash),
      '1',
      'EX',
      this.seenTtlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async setTopStories(snapshot: TopStoriesSnapshot): Promise<void> {
    await this.redis.set(
      TOP_STORIES_KEY,
      JSON.stringify(snapshot),
      'EX',
      this.trendTtlSeconds,
    );
  }

  async getTopStories(): Promise<TopStoriesSnapshot | null> {
    const value = await this.redis.get(TOP_STORIES_KEY);
    return value ? (JSON.parse(value) as TopStoriesSnapshot) : null;
  }
}
