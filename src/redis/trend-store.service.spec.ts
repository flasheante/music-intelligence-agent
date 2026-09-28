import { ConfigService } from '@nestjs/config';
import { TrendStoreService } from './trend-store.service';
import { AppConfig } from '../config/configuration';

describe('TrendStoreService', () => {
  let redis: {
    multi: jest.Mock;
    zrange: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
  };
  let multiChain: {
    zadd: jest.Mock;
    set: jest.Mock;
    expire: jest.Mock;
    exec: jest.Mock;
  };
  let service: TrendStoreService;

  beforeEach(() => {
    multiChain = {
      zadd: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      multi: jest.fn().mockReturnValue(multiChain),
      zrange: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    const config = {
      get: (key: string) => {
        const values: Record<string, number> = {
          'trend.ttlHours': 24,
          'trend.seenItemTtlHours': 48,
        };
        return values[key];
      },
    } as unknown as ConfigService<AppConfig, true>;

    service = new TrendStoreService(redis as any, config);
  });

  it('records a sample as a timestamped zset member with TTL applied', async () => {
    await service.recordSample('oasis-2027', 2000, 1000);

    expect(multiChain.zadd).toHaveBeenCalledWith(
      'music:trend:oasis-2027:samples',
      1000,
      '1000:2000',
    );
    expect(multiChain.expire).toHaveBeenCalledWith(
      'music:trend:oasis-2027:samples',
      24 * 3600,
    );
  });

  it('returns 0 velocity when fewer than two samples exist', async () => {
    redis.zrange.mockResolvedValue(['1000:2000']);

    expect(await service.computeVelocity('oasis-2027')).toBe(0);
  });

  it('computes growth rate between first and last sample', async () => {
    redis.zrange.mockResolvedValue(['1000:2000', '2000:4000']);

    expect(await service.computeVelocity('oasis-2027')).toBe(1);
  });

  it('marks a URL hash as seen only once within the TTL window', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    expect(await service.markSeenIfNew('abc123')).toBe(true);
    expect(await service.markSeenIfNew('abc123')).toBe(false);
    expect(redis.set).toHaveBeenCalledWith(
      'music:seen:abc123',
      '1',
      'EX',
      48 * 3600,
      'NX',
    );
  });

  it('stores the top snapshot with the trend TTL and reads it back', async () => {
    const snapshot = { generatedAt: '2026-09-28T12:00:00.000Z', stories: [] };
    redis.get.mockResolvedValue(JSON.stringify(snapshot));

    await service.setTopStories(snapshot);

    expect(redis.set).toHaveBeenCalledWith(
      'music:top',
      JSON.stringify(snapshot),
      'EX',
      24 * 3600,
    );
    expect(await service.getTopStories()).toEqual(snapshot);
  });

  it('returns null when no ranking has been published yet', async () => {
    redis.get.mockResolvedValue(null);

    expect(await service.getTopStories()).toBeNull();
  });
});
