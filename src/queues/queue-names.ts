/**
 * Collapsed for MVP: normalization + entity-analysis + story-clustering run in
 * one `processing` queue/worker rather than three, since source volume doesn't
 * justify separate scaling/retry policies yet. Revisit if a stage becomes a
 * bottleneck.
 */
export const QUEUE_NAMES = {
  SOURCE_COLLECTION: 'source-collection',
  PROCESSING: 'processing',
  TREND_ANALYSIS: 'trend-analysis',
  AI_ANALYSIS: 'ai-analysis',
  RANKING: 'ranking',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
