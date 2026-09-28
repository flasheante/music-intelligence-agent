import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get()
  async check() {
    try {
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException('redis unavailable');
    }

    return { status: 'ok', redis: 'ok' };
  }
}
