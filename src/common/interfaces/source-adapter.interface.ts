import { SourceItem, SourceType } from './source-item.interface';

/**
 * Whatever shape a given origin returns (RSS item, YouTube API resource, social
 * payload...). Adapters own this shape internally; nothing outside the adapter
 * should depend on its fields.
 */
export type RawSourceItem = Record<string, unknown>;

/**
 * Every collector (RSS, YouTube, social, ...) implements this. The collector
 * layer only calls getItems()/normalize() and never reaches into a source's
 * internal representation.
 */
export interface SourceAdapter<TRaw extends RawSourceItem = RawSourceItem> {
  readonly name: string;
  readonly sourceType: SourceType;

  getItems(): Promise<TRaw[]>;
  normalize(raw: TRaw): SourceItem;
}
