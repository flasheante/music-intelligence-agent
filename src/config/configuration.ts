export interface AppConfig {
  port: number;
  redisUrl: string;
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
  };
  intervals: {
    newsMinutes: number;
    youtubeMinutes: number;
    socialMinutes: number;
  };
  trend: {
    ttlHours: number;
    seenItemTtlHours: number;
  };
  news: {
    /** Items older than this are ignored; also the clustering time window. */
    maxAgeHours: number;
  };
  frontendUrl: string;
  topNewsLimit: number;
  youtube: {
    apiKey?: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'anthropic',
    model: process.env.LLM_MODEL ?? 'claude-sonnet-5',
    apiKey: process.env.LLM_API_KEY,
  },
  intervals: {
    newsMinutes: parseInt(process.env.NEWS_INTERVAL_MINUTES ?? '15', 10),
    youtubeMinutes: parseInt(process.env.YOUTUBE_INTERVAL_MINUTES ?? '30', 10),
    socialMinutes: parseInt(process.env.SOCIAL_INTERVAL_MINUTES ?? '15', 10),
  },
  trend: {
    ttlHours: parseInt(process.env.TREND_TTL_HOURS ?? '24', 10),
    seenItemTtlHours: parseInt(process.env.SEEN_ITEM_TTL_HOURS ?? '48', 10),
  },
  news: {
    maxAgeHours: parseInt(process.env.NEWS_MAX_AGE_HOURS ?? '48', 10),
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  topNewsLimit: parseInt(process.env.TOP_NEWS_LIMIT ?? '10', 10),
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
});
