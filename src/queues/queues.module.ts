import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { QUEUE_NAMES } from './queue-names';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: {
          url: config.get('redisUrl', { infer: true }),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SOURCE_COLLECTION },
      { name: QUEUE_NAMES.PROCESSING },
      { name: QUEUE_NAMES.TREND_ANALYSIS },
      { name: QUEUE_NAMES.AI_ANALYSIS },
      { name: QUEUE_NAMES.RANKING },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
