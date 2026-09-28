import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { TopStory } from './common/interfaces/top-story.interface';
import { PipelineService } from './pipeline/pipeline.service';
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
    const limit = app
      .get<ConfigService<AppConfig, true>>(ConfigService)
      .get('topNewsLimit', { infer: true });

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
  console.error(error);
  process.exit(1);
});
