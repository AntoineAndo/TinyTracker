// Pure helpers for line-chart visualisations of tracker history (used by the
// Overlay view). Wraps the per-day series produced by `lib/correlations.ts`
// and normalizes values into a shared [0, 1] band so trackers of different
// types can be compared on the same axis.

import { buildDailySeries } from './correlations';
import { Entry, Tracker } from './types';
import { toDateString } from './utils';

/**
 * Returns a [0, 1]-normalized series aligned to `dayKeys`. Null entries stay
 * null (rendered as gaps in the chart). Range trackers with `direction='down'`
 * are inverted before normalization so a "lower-is-better" curve visually
 * trends upward when the user does well.
 *
 * Edge case: when all non-null values are equal (zero variance), every value
 * is mapped to 0.5 so the line still renders at a sensible mid-band height.
 */
export function buildNormalizedSeries(
  tracker: Tracker,
  dayKeys: string[],
  entryByDay: Record<string, Entry>,
): (number | null)[] {
  const raw = buildDailySeries(tracker, dayKeys, entryByDay);

  let min = Infinity;
  let max = -Infinity;
  for (const v of raw) {
    if (v === null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min) || !isFinite(max)) return raw.map(() => null);

  const range = max - min;
  if (range === 0) return raw.map((v) => (v === null ? null : 0.5));

  // For range trackers with `direction === 'down'`, invert via the actual data
  // window (min + max - v) instead of a hardcoded 6 - v, since range scales
  // are not guaranteed to be 1..5. This keeps "doing well" visually trending up.
  const invert = tracker.type === 'range' && tracker.direction === 'down';
  return raw.map((v) => {
    if (v === null) return null;
    const oriented = invert ? (min + max - v) : v;
    return (oriented - min) / range;
  });
}

/** Trailing window of YYYY-MM-DD keys ending at `today` (inclusive). */
export function lastNDayKeys(today: Date, n: number): string[] {
  const keys: string[] = [];
  const DAY = 86400000;
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  const startMs = end.getTime() - (n - 1) * DAY;
  for (let i = 0; i < n; i++) {
    keys.push(toDateString(new Date(startMs + i * DAY)));
  }
  return keys;
}
