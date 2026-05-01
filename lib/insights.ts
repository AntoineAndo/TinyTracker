// Unified ranking layer above the pairwise correlation engine and the
// single-tracker trend engine. Wraps each kind in a discriminated union so
// the InsightsSection UI can render them in one ordered feed without the two
// engines needing to know about each other.

import { Finding, findingWeight } from './correlations';
import { TrendInsight, trendWeight } from './trends';

export type Insight =
  | { kind: 'pair'; finding: Finding }
  | { kind: 'trend'; trend: TrendInsight };

export function insightWeight(i: Insight): number {
  return i.kind === 'pair' ? findingWeight(i.finding) : trendWeight(i.trend);
}

export function insightHeadline(i: Insight): string {
  return i.kind === 'pair' ? i.finding.headline : i.trend.headline;
}

export function insightSampleSize(i: Insight): number {
  return i.kind === 'pair' ? i.finding.n : i.trend.n;
}

/**
 * Stable id used as a React key. Pair findings encode tracker IDs + lag;
 * trend findings encode tracker ID + kind so a tracker can have both a
 * recent-shift card and a streak card without collision.
 */
export function insightId(i: Insight): string {
  if (i.kind === 'pair') {
    const lag = i.finding.lag ?? 0;
    return `pair:${i.finding.trackerA.id}:${i.finding.trackerB.id}:${lag}`;
  }
  return `trend:${i.trend.tracker.id}:${i.trend.kind}`;
}

/**
 * Merge pair and trend findings, rank by visual weight, and truncate.
 * A small log-scaled sample-size bonus is mixed in so very strong but
 * sparsely-supported findings don't beat well-supported ones with a slightly
 * smaller effect size.
 */
export function mergeInsights(
  findings: Finding[],
  trends: TrendInsight[],
  topK: number,
): Insight[] {
  const pairs: Insight[] = findings.map((f) => ({ kind: 'pair' as const, finding: f }));
  const ts: Insight[] = trends.map((t) => ({ kind: 'trend' as const, trend: t }));
  const all: Insight[] = [...pairs, ...ts];

  return all
    .map((i) => ({
      i,
      // Weight × log(n+1) softly rewards sample size without letting it dominate.
      score: insightWeight(i) * Math.log(insightSampleSize(i) + 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.i);
}
