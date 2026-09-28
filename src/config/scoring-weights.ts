export interface ScoringWeights {
  sourceVolume: number;
  velocity: number;
  engagement: number;
  authority: number;
  geographicReach: number;
  freshness: number;
}

export const scoringWeights: ScoringWeights = {
  sourceVolume: 0.25,
  velocity: 0.2,
  engagement: 0.2,
  authority: 0.15,
  geographicReach: 0.1,
  freshness: 0.1,
};
