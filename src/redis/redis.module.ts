import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { TrendStoreService } from './trend-store.service';

const logger = new Logger('Redis');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const client = new Redis(config.get('redisUrl', { infer: true }));
        // Without a listener ioredis prints "Unhandled error event" with a
        // stack on every reconnect attempt; log one line instead.
        client.on('error', (error: Error) =>
          logger.warn(`Redis connection error: ${error.message}`),
        );
        return client;
      },
    },
    TrendStoreService,
  ],
  exports: [REDIS_CLIENT, TrendStoreService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    // QUIT waits for a live connection; on one that never came up (bad URL,
    // unreachable host) it would hang shutdown forever, so just drop it.
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }
}
