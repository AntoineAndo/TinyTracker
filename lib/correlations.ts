// Pure-domain correlation/insights engine. Given trackers, their per-day
// entry pivots, and a horizon, produce a ranked list of pairwise findings in
// plain English. No React, no IO. The heart of the algorithm is the per-type
// missing-data resolution: a missing entry for a goal-boolean tracker means
// "didn't do it" (zero), but a missing entry for a range tracker is genuinely
// unknown and the day is dropped from that pair's series.

import { Entry, Tracker } from './types';
import { toDateString, toNumericValue, trackerInterval } from './utils';

export type FindingKind = 'cont-cont' | 'bin-cont' | 'bin-bin';

export interface Finding {
  /** Always the binary tracker for bin-cont; arbitrary order for cont-cont and bin-bin. */
  trackerA: Tracker;
  trackerB: Tracker;
  kind: FindingKind;
  /** Number of valid pair-days used after null-drop. */
  n: number;
  /** Effect size: Spearman rho (cont-cont), Cohen's d (bin-cont), proportion delta (bin-bin). */
  primary: number;
  headline: string;
  /** bin-cont extras for chip rendering. */
  conditionalMeans?: { onA: number; offA: number };
  /** bin-bin extras for chip rendering. */
  proportions?: { pIfA: number; pIfNotA: number };
  /**
   * Day offset from trackerA to trackerB. 0 = same-day correlation. Positive
   * means trackerA leads trackerB by `lag` days (e.g. lag=1: A on day d
   * predicts B on day d+1). For cont-cont we canonicalize so trackerA is the
   * leader when lag != 0; for bin-cont the binary tracker is always the
   * leader, so lag is in {0, 1} only.
   */
  lag?: number;
}

/**
 * Cross-kind 0..1 visual weight for a finding. Used by the Constellation view
 * to scale edge thickness/opacity. cont-cont uses |rho| (already 0..1);
 * bin-bin uses |Δp| (already 0..1); bin-cont uses |d| clamped at 1.5 so a
 * "very large" Cohen's d (~1.5) saturates the visual weight at 1.
 */
export function findingWeight(f: Finding): number {
  if (f.kind === 'bin-cont') return Math.min(1, Math.abs(f.primary) / 1.5);
  return Math.min(1, Math.abs(f.primary));
}

export interface PairwiseOptions {
  horizonDays?: number;
  topK?: number;
  /** Today as a logical-day Date. The pair universe ends at today minus 1 day. */
  today: Date;
}

const DEFAULT_HORIZON = 180;
const DEFAULT_TOP_K = 5;
const MIN_N = 14;
const MIN_GROUP_N = 5;
const RHO_THRESHOLD = 0.3;
const D_THRESHOLD = 0.5;
const PROP_DELTA_THRESHOLD = 0.15;
// Lags scanned when looking for "X today predicts Y tomorrow" patterns.
// Symmetric for cont-cont (we canonicalize the leader); positive-only for
// bin-cont since the binary tracker is treated as the conditioner.
const LAGS_CONT: number[] = [-1, 0, 1];
const LAGS_BIN: number[] = [0, 1];
// Don't surface a lagged finding unless it beats the same-day correlation by
// at least 10%. Without this, single-day jitter would routinely produce
// lag-1 findings whose effect is statistically indistinguishable from lag-0.
const LAG_PREFER_FACTOR = 1.1;

// ── Classification ────────────────────────────────────────────────────────────

/** Treat a tracker as binary when its values reduce to a 0/1 outcome. */
function classify(t: Tracker): 'binary' | 'continuous' {
  const orientation = t.orientation ?? 'goal';
  if (t.type === 'boolean' && orientation === 'goal') return 'binary';
  if (t.type === 'count' && orientation === 'goal' && (t.target ?? 1) === 1) return 'binary';
  return 'continuous';
}

// ── Per-day value (missing-data table) ───────────────────────────────────────

/**
 * Resolve a tracker's value on a logical day. Returns null when the day is
 * genuinely unknown (skip from analysis); returns 0 when missing carries the
 * meaning "didn't do it" (goal-oriented boolean and most goal counts).
 */
export function dailyValue(t: Tracker, entry: Entry | undefined): number | null {
  const orientation = t.orientation ?? 'goal';

  if (t.type === 'boolean') {
    if (entry) return toNumericValue(entry.value);
    return orientation === 'goal' ? 0 : null;
  }

  if (t.type === 'count') {
    if (entry) return toNumericValue(entry.value);
    if (orientation !== 'goal') return null;
    // Direction 'down' means lower-is-better (e.g. drinks/day): zero is a
    // good outcome but absence here is "didn't log", not "had zero".
    if (t.direction === 'down') return null;
    return 0;
  }

  if (t.type === 'log') {
    if (entry && entry.completed === true) return toNumericValue(entry.value);
    return null;
  }

  // range
  if (entry) return toNumericValue(entry.value);
  return null;
}

/** Aligns a tracker to a contiguous day-key window, applying missing-data rules. */
export function buildDailySeries(
  tracker: Tracker,
  dayKeys: string[],
  entryByDay: Record<string, Entry>,
): (number | null)[] {
  return dayKeys.map((k) => dailyValue(tracker, entryByDay[k]));
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** Average rank for ties; 1-based. */
function rank(xs: number[]): number[] {
  const n = xs.length;
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const out = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

/** Spearman rank correlation. Returns 0 when undefined (zero variance or n < 2). */
export function spearmanRho(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0;
  return pearson(rank(a), rank(b));
}

/** Cohen's d (pooled SD). Returns 0 when undefined. */
export function cohensD(group0: number[], group1: number[]): number {
  const n0 = group0.length, n1 = group1.length;
  if (n0 < 2 || n1 < 2) return 0;
  const m0 = group0.reduce((s, x) => s + x, 0) / n0;
  const m1 = group1.reduce((s, x) => s + x, 0) / n1;
  const v0 = group0.reduce((s, x) => s + (x - m0) ** 2, 0) / (n0 - 1);
  const v1 = group1.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1);
  const pooled = Math.sqrt(((n0 - 1) * v0 + (n1 - 1) * v1) / (n0 + n1 - 2));
  if (pooled === 0) return 0;
  return (m1 - m0) / pooled;
}

// ── Lag alignment ─────────────────────────────────────────────────────────────

/**
 * Pairs two daily series at a given lag. lag > 0 aligns A[k] with B[k+lag]
 * (A leads B); lag < 0 aligns A[k] with B[k+lag] (B leads A). Drops indices
 * where either side is null or out of bounds.
 */
function pairWithLag(
  seriesA: (number | null)[],
  seriesB: (number | null)[],
  lag: number,
): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  const n = seriesA.length;
  for (let k = 0; k < n; k++) {
    const j = k + lag;
    if (j < 0 || j >= n) continue;
    const va = seriesA[k];
    const vb = seriesB[j];
    if (va === null || vb === null) continue;
    a.push(va);
    b.push(vb);
  }
  return { a, b };
}

/**
 * Scan candidate lags for cont-cont. Returns the best |rho| pairing, with
 * `swapped=true` indicating the canonical form should swap A/B (so the
 * stored Finding always has trackerA as the leader and lag >= 0).
 */
function bestLagContCont(
  seriesA: (number | null)[],
  seriesB: (number | null)[],
  minN: number,
): { rho: number; lag: number; n: number; swapped: boolean } | null {
  let zero: { rho: number; n: number } | null = null;
  let best: { rho: number; lag: number; n: number; swapped: boolean } | null = null;
  for (const lag of LAGS_CONT) {
    const { a, b } = pairWithLag(seriesA, seriesB, lag);
    if (a.length < minN) continue;
    const rho = spearmanRho(a, b);
    if (lag === 0) zero = { rho, n: a.length };
    const candidate = {
      rho,
      lag: Math.abs(lag),
      n: a.length,
      swapped: lag < 0,
    };
    if (!best || Math.abs(rho) > Math.abs(best.rho)) best = candidate;
  }
  // Prefer lag=0 unless a non-zero lag clears the noise floor.
  if (best && best.lag !== 0 && zero) {
    if (Math.abs(best.rho) < LAG_PREFER_FACTOR * Math.abs(zero.rho)) {
      best = { rho: zero.rho, lag: 0, n: zero.n, swapped: false };
    }
  }
  return best;
}

// ── Day iteration ─────────────────────────────────────────────────────────────

function dayKeysFromTo(fromDate: Date, toDate: Date): string[] {
  const keys: string[] = [];
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    keys.push(toDateString(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

// ── Headline templating ───────────────────────────────────────────────────────

function fmtNumber(x: number): string {
  if (Math.abs(x) >= 100) return x.toFixed(0);
  if (Math.abs(x) >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function headlineContCont(a: Tracker, b: Tracker, rho: number, lag: number): string {
  if (lag > 0) {
    const direction = rho > 0 ? 'higher' : 'lower';
    return `Higher ${a.name} tends to be followed by ${direction} ${b.name} the next day.`;
  }
  if (rho > 0) return `${a.name} and ${b.name} tend to move together.`;
  return `When ${a.name} is higher, ${b.name} tends to be lower.`;
}

function headlineBinCont(
  binary: Tracker,
  cont: Tracker,
  m1: number,
  m0: number,
  lag: number,
): string {
  const delta = m1 - m0;
  const sign = delta >= 0 ? 'higher' : 'lower';
  if (lag > 0) {
    return `After ${binary.name} days, ${cont.name} tends to be ${sign} (${fmtNumber(Math.abs(delta))} on average).`;
  }
  return `On ${binary.name} days, ${cont.name} averages ${fmtNumber(m1)} (${fmtNumber(Math.abs(delta))} ${sign} than other days).`;
}

function headlineBinBin(a: Tracker, b: Tracker, p1: number, p0: number): string {
  return `On ${a.name} days, ${b.name} happens ${fmtPct(p1)} of the time (vs ${fmtPct(p0)} otherwise).`;
}

// ── Public API ────────────────────────────────────────────────────────────────

function sharesRoutine(a: string, b: string, mem: Record<string, Set<string>>): boolean {
  const sa = mem[a];
  const sb = mem[b];
  if (!sa || !sb) return false;
  for (const r of sa) if (sb.has(r)) return true;
  return false;
}

/**
 * Scan all eligible tracker pairs and produce ranked findings.
 *
 * Eligibility filters:
 *   - daily reminderFrequency only (weekly/custom would create sparsity artifacts)
 *   - not co-members of a routine (mechanical correlation by design)
 *   - at least MIN_N (=14) valid pair-days after null-drop
 *
 * Surfacing thresholds (per kind): see RHO_THRESHOLD, D_THRESHOLD,
 * PROP_DELTA_THRESHOLD plus per-group MIN_GROUP_N for asymmetric tests.
 */
export function findPairwiseInsights(
  trackers: Tracker[],
  routineMembership: Record<string, Set<string>>,
  byTrackerByDay: Record<string, Record<string, Entry>>,
  options: PairwiseOptions,
): Finding[] {
  const horizon = options.horizonDays ?? DEFAULT_HORIZON;
  const topK = options.topK ?? DEFAULT_TOP_K;

  const eligible = trackers.filter((t) => trackerInterval(t) === 1);

  // Yesterday cutoff: today is incomplete by definition.
  const yesterday = new Date(options.today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Cap how far back any pair's universe can extend.
  const horizonStart = new Date(options.today);
  horizonStart.setDate(horizonStart.getDate() - horizon);
  horizonStart.setHours(0, 0, 0, 0);

  const findings: Finding[] = [];

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];

      if (sharesRoutine(a.id, b.id, routineMembership)) continue;

      // Skip the partial creation day; both trackers must have existed.
      const aStart = new Date(a.createdAt);
      const bStart = new Date(b.createdAt);
      const universeStart = new Date(Math.max(aStart.getTime(), bStart.getTime()));
      universeStart.setHours(0, 0, 0, 0);
      universeStart.setDate(universeStart.getDate() + 1);
      if (universeStart < horizonStart) universeStart.setTime(horizonStart.getTime());
      if (universeStart > yesterday) continue;

      const dayKeys = dayKeysFromTo(universeStart, yesterday);
      if (dayKeys.length < MIN_N) continue;

      const seriesA = buildDailySeries(a, dayKeys, byTrackerByDay[a.id] ?? {});
      const seriesB = buildDailySeries(b, dayKeys, byTrackerByDay[b.id] ?? {});

      // Cheap pre-flight: if same-day overlap is too small, no lag will help.
      let sameDayN = 0;
      for (let k = 0; k < dayKeys.length; k++) {
        if (seriesA[k] !== null && seriesB[k] !== null) sameDayN++;
      }
      if (sameDayN < MIN_N) continue;

      const kindA = classify(a);
      const kindB = classify(b);
      let finding: Finding | null = null;

      if (kindA === 'continuous' && kindB === 'continuous') {
        const best = bestLagContCont(seriesA, seriesB, MIN_N);
        if (!best) continue;
        if (Math.abs(best.rho) < RHO_THRESHOLD) continue;
        // Canonical form: trackerA leads trackerB. If best lag was negative,
        // swap so the headline reads in temporal order.
        const leader = best.swapped ? b : a;
        const follower = best.swapped ? a : b;
        finding = {
          trackerA: leader,
          trackerB: follower,
          kind: 'cont-cont',
          n: best.n,
          primary: best.rho,
          lag: best.lag,
          headline: headlineContCont(leader, follower, best.rho, best.lag),
        };
      } else if (kindA === 'binary' && kindB === 'binary') {
        // Binary-binary: same-day only for now. Lagging here would mean
        // "Did X yesterday → did Y today", which is plausible but produces
        // very confusing headlines and tiny per-cell counts.
        const validA: number[] = [];
        const validB: number[] = [];
        for (let k = 0; k < dayKeys.length; k++) {
          if (seriesA[k] === null || seriesB[k] === null) continue;
          validA.push(seriesA[k] as number);
          validB.push(seriesB[k] as number);
        }
        let n1 = 0, n0 = 0, b1 = 0, b0 = 0;
        for (let k = 0; k < validA.length; k++) {
          if (validA[k] >= 1) { n1++; if (validB[k] >= 1) b1++; }
          else { n0++; if (validB[k] >= 1) b0++; }
        }
        if (n1 < MIN_GROUP_N || n0 < MIN_GROUP_N) continue;
        const p1 = b1 / n1;
        const p0 = b0 / n0;
        const delta = p1 - p0;
        if (Math.abs(delta) < PROP_DELTA_THRESHOLD) continue;
        finding = {
          trackerA: a,
          trackerB: b,
          kind: 'bin-bin',
          n: validA.length,
          primary: delta,
          lag: 0,
          headline: headlineBinBin(a, b, p1, p0),
          proportions: { pIfA: p1, pIfNotA: p0 },
        };
      } else {
        // Binary x continuous: always frame the binary as the conditioner
        // (and as the temporal leader when lag > 0).
        const binTracker = kindA === 'binary' ? a : b;
        const contTracker = kindA === 'binary' ? b : a;
        const binSeries = kindA === 'binary' ? seriesA : seriesB;
        const contSeries = kindA === 'binary' ? seriesB : seriesA;

        type BinContPick = { d: number; lag: number; n: number; m1: number; m0: number };
        let zeroPick: BinContPick | null = null;
        let bestPick: BinContPick | null = null;
        for (const lag of LAGS_BIN) {
          const { a: binPaired, b: contPaired } = pairWithLag(binSeries, contSeries, lag);
          if (binPaired.length < MIN_N) continue;
          const group1: number[] = [], group0: number[] = [];
          for (let k = 0; k < binPaired.length; k++) {
            if (binPaired[k] >= 1) group1.push(contPaired[k]);
            else group0.push(contPaired[k]);
          }
          if (group0.length < MIN_GROUP_N || group1.length < MIN_GROUP_N) continue;
          const d = cohensD(group0, group1);
          const m1 = group1.reduce((s, x) => s + x, 0) / group1.length;
          const m0 = group0.reduce((s, x) => s + x, 0) / group0.length;
          const pick: BinContPick = { d, lag, n: binPaired.length, m1, m0 };
          if (lag === 0) zeroPick = pick;
          if (!bestPick || Math.abs(d) > Math.abs(bestPick.d)) bestPick = pick;
        }
        if (!bestPick) continue;
        // Same noise-floor preference as cont-cont: don't commit to a lag != 0
        // result unless it clears the same-day effect by LAG_PREFER_FACTOR.
        if (bestPick.lag !== 0 && zeroPick && Math.abs(bestPick.d) < LAG_PREFER_FACTOR * Math.abs(zeroPick.d)) {
          bestPick = zeroPick;
        }
        if (Math.abs(bestPick.d) < D_THRESHOLD) continue;
        finding = {
          trackerA: binTracker,
          trackerB: contTracker,
          kind: 'bin-cont',
          n: bestPick.n,
          primary: bestPick.d,
          lag: bestPick.lag,
          headline: headlineBinCont(binTracker, contTracker, bestPick.m1, bestPick.m0, bestPick.lag),
          conditionalMeans: { onA: bestPick.m1, offA: bestPick.m0 },
        };
      }

      if (finding) findings.push(finding);
    }
  }

  findings.sort((x, y) => Math.abs(y.primary) - Math.abs(x.primary));
  return findings.slice(0, topK);
}
