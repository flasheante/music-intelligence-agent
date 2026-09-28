import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { TrendStoreService } from './trend-store.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new Redis(config.get('redisUrl', { infer: true })),
    },
    TrendStoreService,
  ],
  exports: [REDIS_CLIENT, TrendStoreService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
