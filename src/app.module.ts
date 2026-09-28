import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { NewsModule } from './news/news.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PipelineSchedulerModule } from './pipeline/pipeline-scheduler.module';

export interface AppModuleOptions {
  /**
   * Start the BullMQ worker and repeat schedule (and with them, the queue
   * connections). Off for CLI runs - including the GitHub Actions refresh -
   * and tests.
   */
  scheduler?: boolean;
}

@Module({})
export class AppModule {
  static register({ scheduler = true }: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        RedisModule,
        HealthModule,
        PipelineModule,
        NewsModule,
        ...(scheduler ? [PipelineSchedulerModule] : []),
      ],
    };
  }
}
