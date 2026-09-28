import { VerificationStatus } from '../common/enums/verification-status.enum';
import { scoringWeights } from '../config/scoring-weights';
import {
  computeScore,
  freshnessSignal,
  sourceVolumeSignal,
  trendLevel,
  verificationStatus,
} from './scoring';

describe('computeScore', () => {
  it('is 10 when every signal is maxed and 0 when all are zero', () => {
    const all = (value: number) => ({
      sourceVolume: value,
      velocity: value,
      engagement: value,
      authority: value,
      geographicReach: value,
      freshness: value,
    });

    expect(computeScore(all(1), scoringWeights)).toBe(10);
    expect(computeScore(all(0), scoringWeights)).toBe(0);
  });

  it('applies the configured weights', () => {
    expect(
      computeScore(
        {
          sourceVolume: 1,
          velocity: 0,
          engagement: 0,
          authority: 0,
          geographicReach: 0,
          freshness: 0,
        },
        scoringWeights,
      ),
    ).toBe(2.5);
  });

  it('re-normalises over the signals a story actually has', () => {
    expect(
      computeScore(
        {
          sourceVolume: 1,
          velocity: 1,
          engagement: undefined,
          authority: 1,
          geographicReach: 1,
          freshness: 1,
        },
        scoringWeights,
      ),
    ).toBe(10);
  });
});

describe('signals', () => {
  it('source volume grows with outlets and saturates', () => {
    expect(sourceVolumeSignal(1)).toBeLessThan(sourceVolumeSignal(3));
    expect(sourceVolumeSignal(8)).toBe(1);
    expect(sourceVolumeSignal(20)).toBe(1);
  });

  it('freshness halves every 12 hours', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    expect(freshnessSignal(now, now)).toBe(1);
    expect(freshnessSignal(new Date('2026-09-28T00:00:00Z'), now)).toBeCloseTo(
      0.5,
    );
  });

  it('maps scores to trend levels', () => {
    expect(trendLevel(9)).toBe('VERY_HIGH');
    expect(trendLevel(6)).toBe('HIGH');
    expect(trendLevel(4)).toBe('MEDIUM');
    expect(trendLevel(1)).toBe('LOW');
  });
});

describe('verificationStatus', () => {
  const base = { rumorItems: 0, totalItems: 1, maxAuthority: 0.7 };

  it('never promotes a widely repeated rumor to confirmed', () => {
    expect(
      verificationStatus({
        sourceCount: 6,
        rumorItems: 4,
        totalItems: 6,
        maxAuthority: 0.95,
      }),
    ).toBe(VerificationStatus.RUMOR);
  });

  it('grades by independent outlets and authority', () => {
    expect(verificationStatus({ ...base, sourceCount: 3 })).toBe(
      VerificationStatus.CONFIRMED,
    );
    expect(verificationStatus({ ...base, sourceCount: 2 })).toBe(
      VerificationStatus.LIKELY,
    );
    expect(
      verificationStatus({ ...base, sourceCount: 1, maxAuthority: 0.95 }),
    ).toBe(VerificationStatus.LIKELY);
    expect(verificationStatus({ ...base, sourceCount: 1 })).toBe(
      VerificationStatus.UNCONFIRMED,
    );
  });
});
