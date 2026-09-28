import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { TopStory } from './common/interfaces/top-story.interface';
import { PipelineService } from './pipeline/pipeline.service';
import { REDIS_CLIENT } from './redis/redis.constants';
import { diagnoseRedisUrl } from './redis/redis-probe';
import { TrendStoreService } from './redis/trend-store.service';

const TREND_FLAMES: Record<TopStory['trendLevel'], string> = {
  LOW: '🔥',
  MEDIUM: '🔥🔥',
  HIGH: '🔥🔥🔥',
  VERY_HIGH: '🔥🔥🔥🔥',
};

/** Spec 22 console format. */
function printTop(stories: TopStory[], generatedAt: string | null): void {
  console.log('\n🔥 TOP 10 MUSIC STORIES');
  console.log(generatedAt ? `   ${generatedAt}\n` : '');

  if (stories.length === 0) {
    console.log('   No ranking yet. Run `npm run refresh`.\n');
    return;
  }

  for (const story of stories) {
    console.log(`${story.rank}. ${story.title}`);
    console.log(
      `   ${story.regions.join(' · ')}  |  ${story.genres.join(' · ')} · ${story.type}`,
    );
    console.log(
      `   Trend: ${TREND_FLAMES[story.trendLevel]} ${story.score}/10  |  ` +
        `Sources: ${story.sourceCount}  |  ${story.verificationStatus}`,
    );
    console.log(`   ${story.sources.map((s) => s.name).join(', ')}\n`);
  }
}

const REDIS_CHECK_TIMEOUT_MS = 10_000;

/** "rediss://default:secret@host:6379" → "rediss://host:6379" (never log the password). */
function describeRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '(unparseable REDIS_URL)';
  }
}

async function checkRedis(redis: Redis, url: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('timed out')),
          REDIS_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach Redis at ${describeRedisUrl(url)} (${reason}).\n` +
        `Diagnosis: ${await diagnoseRedisUrl(url)}\n` +
        'For Upstash, REDIS_URL must be the ioredis URL from the Connect ' +
        'panel: rediss://default:<password>@<endpoint>.upstash.io:6379 ' +
        '(the password is not the REST token).',
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `npm run top`      prints the current ranking.
 * `npm run refresh`  runs the full pipeline, then prints the new ranking.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'refresh';
  const app = await NestFactory.createApplicationContext(
    AppModule.register({ scheduler: false }),
    { logger: ['log', 'warn', 'error'] },
  );

  try {
    const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
    const limit = config.get('topNewsLimit', { infer: true });

    // Fail before spending a collection run on a Redis we can't write to.
    await checkRedis(
      app.get<Redis>(REDIS_CLIENT),
      config.get('redisUrl', { infer: true }),
    );

    if (command === 'top') {
      const snapshot = await app.get(TrendStoreService).getTopStories();
      printTop(
        snapshot?.stories.slice(0, limit) ?? [],
        snapshot?.generatedAt ?? null,
      );
    } else if (command === 'refresh') {
      const { snapshot, sources } = await app.get(PipelineService).run();
      for (const source of sources) {
        console.log(
          `${source.ok ? '✓' : '✗'} ${source.source.padEnd(26)} ${source.ok ? `${source.items} items` : source.error}`,
        );
      }
      printTop(snapshot.stories.slice(0, limit), snapshot.generatedAt);
    } else {
      console.error(`Unknown command "${command}". Use: top | refresh`);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
