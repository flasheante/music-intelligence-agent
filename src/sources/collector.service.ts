import { Inject, Injectable, Logger } from '@nestjs/common';
import { SourceAdapter } from '../common/interfaces/source-adapter.interface';
import { SourceItem } from '../common/interfaces/source-item.interface';
import { NEWS_SOURCES } from './news-sources.config';
import { RssAdapter } from './rss.adapter';

export interface SourceRunResult {
  source: string;
  ok: boolean;
  items: number;
  error?: string;
}

export interface CollectionResult {
  items: SourceItem[];
  sources: SourceRunResult[];
}

export const SOURCE_ADAPTERS = Symbol('SOURCE_ADAPTERS');

export function defaultSourceAdapters(): SourceAdapter[] {
  return NEWS_SOURCES.filter((source) => source.enabled).map(
    (source) => new RssAdapter(source),
  );
}

/**
 * Runs every adapter in parallel. A failing source is logged and reported,
 * never thrown - one broken feed must not sink the whole report (spec 31).
 */
@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @Inject(SOURCE_ADAPTERS) private readonly adapters: SourceAdapter[],
  ) {}

  async collect(): Promise<CollectionResult> {
    const results = await Promise.allSettled(
      this.adapters.map(async (adapter) => {
        const raw = await adapter.getItems();
        return raw.map((item) => adapter.normalize(item));
      }),
    );

    const items: SourceItem[] = [];
    const sources: SourceRunResult[] = results.map((result, index) => {
      const source = this.adapters[index].name;

      if (result.status === 'fulfilled') {
        items.push(...result.value);
        return { source, ok: true, items: result.value.length };
      }

      const error =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      this.logger.warn(`Source "${source}" failed: ${error}`);
      return { source, ok: false, items: 0, error };
    });

    return { items, sources };
  }
}
