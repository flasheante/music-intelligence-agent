import { VerificationStatus } from '../common/enums/verification-status.enum';
import { TrendLevel } from '../common/interfaces/top-story.interface';
import { ScoringWeights } from '../config/scoring-weights';

/** Every signal normalised to 0–1. `undefined` = no data for this story. */
export type ScoreSignals = {
  [K in keyof ScoringWeights]: number | undefined;
};

/**
 * Weighted score on a 0–10 scale (spec 17). Signals a story has no data for
 * (e.g. engagement for news-only stories until YouTube/social exist) are left
 * out and the remaining weights re-normalised, so a story isn't capped at 8/10
 * just because a platform isn't wired up yet.
 */
export function computeScore(
  signals: ScoreSignals,
  weights: ScoringWeights,
): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const key of Object.keys(weights) as (keyof ScoringWeights)[]) {
    const value = signals[key];
    if (value === undefined) continue;
    weighted += weights[key] * clamp01(value);
    totalWeight += weights[key];
  }

  if (totalWeight === 0) return 0;
  return Math.round((weighted / totalWeight) * 100) / 10;
}

/** Distinct outlets at which volume stops adding score. */
const SOURCE_SATURATION = 8;
const FRESHNESS_HALF_LIFE_HOURS = 12;
/** ARGENTINA, USA, EUROPE. */
const TRACKED_REGIONS = 3;

export function sourceVolumeSignal(sourceCount: number): number {
  return clamp01(Math.log2(1 + sourceCount) / Math.log2(1 + SOURCE_SATURATION));
}

/** +100% growth or more is the maximum velocity signal. */
export function velocitySignal(velocity: number): number {
  return clamp01(velocity);
}

export function geographicReachSignal(regionCount: number): number {
  return clamp01(regionCount / TRACKED_REGIONS);
}

export function freshnessSignal(lastSeen: Date, now: Date): number {
  const ageHours = Math.max(
    0,
    (now.getTime() - lastSeen.getTime()) / 3_600_000,
  );
  return Math.pow(0.5, ageHours / FRESHNESS_HALF_LIFE_HOURS);
}

export function trendLevel(score: number): TrendLevel {
  if (score >= 7.5) return 'VERY_HIGH';
  if (score >= 5.5) return 'HIGH';
  if (score >= 3.5) return 'MEDIUM';
  return 'LOW';
}

export interface VerificationInput {
  sourceCount: number;
  rumorItems: number;
  totalItems: number;
  maxAuthority: number;
}

/**
 * Spec 21. Rumor wording is checked first, so a rumor repeated by many
 * outlets stays a rumor instead of being promoted to CONFIRMED.
 */
export function verificationStatus({
  sourceCount,
  rumorItems,
  totalItems,
  maxAuthority,
}: VerificationInput): VerificationStatus {
  if (rumorItems > 0 && rumorItems * 2 >= totalItems) {
    return VerificationStatus.RUMOR;
  }
  if (sourceCount >= 3) return VerificationStatus.CONFIRMED;
  if (sourceCount === 2 || maxAuthority >= 0.85) {
    return VerificationStatus.LIKELY;
  }
  return VerificationStatus.UNCONFIRMED;
}

/**
 * Deterministic stand-in until the AI editor (spec 20) produces its own
 * confidence for each story.
 */
const CONFIDENCE_BY_STATUS: Record<VerificationStatus, number> = {
  [VerificationStatus.CONFIRMED]: 0.9,
  [VerificationStatus.LIKELY]: 0.75,
  [VerificationStatus.UNCONFIRMED]: 0.5,
  [VerificationStatus.RUMOR]: 0.3,
};

export function confidenceFor(status: VerificationStatus): number {
  return CONFIDENCE_BY_STATUS[status];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
