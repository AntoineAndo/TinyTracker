// Single-tracker trend & streak detection. Complements the pairwise engine in
// `lib/correlations.ts` by surfacing findings that don't need a second tracker
// to be meaningful: "Sleep is better than last month", "5-day Exercise streak".
// Pure-domain (no React, no IO). Reuses `buildDailySeries` so the same
// per-type missing-data rules apply.

import { buildDailySeries } from './correlations';
import { Entry, Tracker } from './types';
import { toDateString, trackerInterval } from './utils';

export type TrendKind = 'trend-recent' | 'trend-streak';

export interface TrendInsight {
  kind: TrendKind;
  tracker: Tracker;
  /**
   * Days of data inspected to produce this insight. NOT the streak length;
   * for streaks this is the count of recent days actually consulted, so the
   * unified ranker's log(n+1) sample-size term reflects evidence rather than
   * effect (effect is in `primary`).
   */
  n: number;
  /**
   * For 'trend-recent': normalized delta = (recent − baseline) / pooledSD,
   * already sign-flipped so positive always means "improving" relative to the
   * tracker's intended direction.
   * For 'trend-streak': current streak length in days.
   */
  primary: number;
  headline: string;
  /** trend-recent extras for chip rendering. */
  recentVsBaseline?: { recent: number; baseline: number; pctChange: number };
}

// Minimum days needed in each window to compute a baseline comparison.
const MIN_RECENT_N = 4;
const MIN_BASELINE_N = 8;
// Effect-size floor for the recent-vs-baseline comparison. ~0.5 = medium.
const RECENT_DELTA_THRESHOLD = 0.5;
// Below this many days, a "streak" isn't surprising enough to surface.
const MIN_STREAK_DAYS = 5;

const RECENT_WINDOW = 7;
const BASELINE_WINDOW = 21;

/**
 * Cross-kind 0..1 visual weight for a trend insight. Mirrors `findingWeight`
 * so a unified ranker can compare trends and pairs side-by-side.
 */
export function trendWeight(t: TrendInsight): number {
  if (t.kind === 'trend-recent') return Math.min(1, Math.abs(t.primary) / 1.5);
  // 5-day streak ≈ 0.4, 10-day ≈ 0.7, 21-day saturates near 1. Tuned so a
  // healthy streak competes with a moderate Spearman pair finding (|rho| ~0.4)
  // after the log(n+1) sample-size term in mergeInsights.
  const over = Math.max(0, t.primary - (MIN_STREAK_DAYS - 1));
  return Math.min(1, 0.3 + over / 14);
}

// ── Direction & "good day" semantics ─────────────────────────────────────────

/**
 * True if higher tracker values represent the "better" outcome. Drives the
 * sign of normalized deltas so a positive primary always means "improving".
 */
function higherIsBetter(t: Tracker): boolean {
  if (t.direction === 'down') return false;
  // Log trackers with only `max` set (e.g. Screen time) imply lower is better.
  if (t.type === 'log' && t.max !== undefined && t.min === undefined) return false;
  return true;
}

/**
 * Per-type "good day" predicate used by streak detection. Range trackers use
 * 4+/2- thresholds on the 1..5 scale; logs use the soft min/max bands.
 * Neutral-orientation trackers have no goal, so streaks don't apply.
 */
function isGoodDay(tracker: Tracker, value: number): boolean {
  const orientation = tracker.orientation ?? 'goal';
  if (orientation !== 'goal') return false;

  if (tracker.type === 'boolean') return value >= 1;
  if (tracker.type === 'count') {
    const target = tracker.target ?? 1;
    if (tracker.direction === 'down') return value <= target;
    return value >= target;
  }
  if (tracker.type === 'range') {
    if (tracker.direction === 'down') return value <= 2;
    return value >= 4;
  }
  // log: when both bounds are set, both must hold (target band).
  // When only one bound is set, that bound must hold. With no bounds we
  // can't classify "good", so streaks don't apply.
  if (tracker.min === undefined && tracker.max === undefined) return false;
  const minOk = tracker.min === undefined || value >= tracker.min;
  const maxOk = tracker.max === undefined || value <= tracker.max;
  return minOk && maxOk;
}

// ── Day window helpers ───────────────────────────────────────────────────────

function dayKeysEndingAt(end: Date, days: number): string[] {
  const keys: string[] = [];
  const DAY = 86400000;
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  const startMs = last.getTime() - (days - 1) * DAY;
  for (let i = 0; i < days; i++) {
    keys.push(toDateString(new Date(startMs + i * DAY)));
  }
  return keys;
}

// ── Stats ────────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function variance(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (xs.length - 1);
}

/** Pooled standard deviation used to normalize the recent-vs-baseline delta. */
function pooledSd(a: number[], b: number[]): number {
  const na = a.length;
  const nb = b.length;
  if (na < 2 || nb < 2) return 0;
  const va = variance(a, mean(a));
  const vb = variance(b, mean(b));
  return Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
}

// ── Headlines ────────────────────────────────────────────────────────────────

function recentHeadline(t: Tracker, normalizedDelta: number, pctChange: number): string {
  // normalizedDelta is sign-flipped so positive == "improving" regardless of
  // the tracker's direction. pctChange is the raw (recent - baseline) / |baseline|;
  // we phrase using the absolute magnitude plus a better/worse qualifier so the
  // wording stays consistent for both higher-is-better and lower-is-better trackers.
  const verb = normalizedDelta > 0 ? 'better' : 'worse';
  const magnitude = Math.round(Math.abs(pctChange) * 100);
  return `${t.name} is ${verb} than the prior 3 weeks (${magnitude}% change).`;
}

function streakHeadline(t: Tracker, days: number): string {
  return `${t.name}: ${days}-day streak going strong.`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface TrendOptions {
  /** Today as a logical-day Date. Recent window ends at today minus 1. */
  today: Date;
}

/**
 * For each daily, goal-oriented tracker, surface up to two trend findings:
 *   - trend-recent: 7-day vs prior-21-day mean shift, normalized by pooled SD
 *     (sign-flipped so positive = improving, regardless of tracker direction)
 *   - trend-streak: current consecutive run of "good days" ending yesterday
 *
 * Returns all qualifying insights unranked. Use `trendWeight` (or merge with
 * pair findings via `lib/insights.ts`) to rank globally.
 */
export function findTrendInsights(
  trackers: Tracker[],
  byTrackerByDay: Record<string, Record<string, Entry>>,
  options: TrendOptions,
): TrendInsight[] {
  const yesterday = new Date(options.today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const out: TrendInsight[] = [];

  for (const tracker of trackers) {
    if (trackerInterval(tracker) !== 1) continue;
    const orientation = tracker.orientation ?? 'goal';
    if (orientation !== 'goal') continue;

    const entryByDay = byTrackerByDay[tracker.id] ?? {};

    // Recent vs baseline (28-day window).
    const totalDays = RECENT_WINDOW + BASELINE_WINDOW;
    const windowKeys = dayKeysEndingAt(yesterday, totalDays);
    const series = buildDailySeries(tracker, windowKeys, entryByDay);

    const baseline: number[] = [];
    const recent: number[] = [];
    for (let i = 0; i < windowKeys.length; i++) {
      const v = series[i];
      if (v === null) continue;
      if (i < BASELINE_WINDOW) baseline.push(v);
      else recent.push(v);
    }

    if (recent.length >= MIN_RECENT_N && baseline.length >= MIN_BASELINE_N) {
      const mr = mean(recent);
      const mb = mean(baseline);
      const sd = pooledSd(recent, baseline);
      if (sd > 0) {
        const rawDelta = (mr - mb) / sd;
        const normalized = higherIsBetter(tracker) ? rawDelta : -rawDelta;
        if (Math.abs(normalized) >= RECENT_DELTA_THRESHOLD) {
          const pctChange = mb !== 0 ? (mr - mb) / Math.abs(mb) : 0;
          out.push({
            kind: 'trend-recent',
            tracker,
            n: recent.length + baseline.length,
            primary: normalized,
            headline: recentHeadline(tracker, normalized, pctChange),
            recentVsBaseline: { recent: mr, baseline: mb, pctChange },
          });
        }
      }
    }

    // Current streak: walk backward from yesterday over a generous window.
    // Use a 90-day cap so we don't scan unbounded history; streaks longer
    // than that are extraordinary and a 90+ headline still reads well.
    const STREAK_WINDOW = 90;
    const streakKeys = dayKeysEndingAt(yesterday, STREAK_WINDOW);
    const streakSeries = buildDailySeries(tracker, streakKeys, entryByDay);
    let streak = 0;
    let streakSupport = 0;
    for (let i = streakSeries.length - 1; i >= 0; i--) {
      const v = streakSeries[i];
      if (v === null) break;
      streakSupport++;
      if (!isGoodDay(tracker, v)) break;
      streak++;
    }
    if (streak >= MIN_STREAK_DAYS) {
      out.push({
        kind: 'trend-streak',
        tracker,
        // Evidence (days actually inspected), not effect: the streak length
        // lives in `primary` so the ranker doesn't double-count it via log(n+1).
        n: streakSupport,
        primary: streak,
        headline: streakHeadline(tracker, streak),
      });
    }
  }

  return out;
}
