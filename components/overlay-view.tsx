// Overlay: two trackers compared on a shared 30-day timeline. Each series is
// independently min-max normalized into [0, 1] so types with different scales
// (boolean, count, range, log) can be visually compared. The correlation
// readout below the chart pulls the matching Finding from useCorrelations
// when one exists, so this view never disagrees with the Patterns section.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Skeleton } from '@/components/skeleton';
import { TrackerSelect } from '@/components/tracker-select';
import { Border, Radius, Shadow, Space, Type, Weight } from '@/constants/tokens';
import { useTrackers } from '@/context/trackers-context';
import { useCorrelations } from '@/hooks/use-correlations';
import { useCurrentDay } from '@/hooks/use-current-day';
import { useDeferMount } from '@/hooks/use-defer-mount';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { Finding, findingWeight } from '@/lib/correlations';
import { buildNormalizedSeries, lastNDayKeys } from '@/lib/series';
import { getTrackerColorHex, getTrackerColorRgba } from '@/lib/tracker-colors';
import { Tracker } from '@/lib/types';
import { trackerInterval } from '@/lib/utils';

const POSITIVE_INK = '#15803d';
const POSITIVE_BG = 'rgba(34,197,94,0.12)';
const POSITIVE_BORDER = 'rgba(34,197,94,0.35)';
const NEGATIVE_INK = '#b91c1c';
const NEGATIVE_BG = 'rgba(239,68,68,0.10)';
const NEGATIVE_BORDER = 'rgba(239,68,68,0.35)';

const CHART_W = 340;
const CHART_H = 160;
const CHART_PAD = 12;

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { paddingHorizontal: Space.xl, paddingTop: Space.section, paddingBottom: Space['2xl'], gap: Space.lg },
    headerBlock: { gap: Space.xs },
    header: { ...Type.label, color: c.text },
    helper: { ...Type.caption, color: c.textMuted },
    card: {
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.lg,
      borderWidth: Border.hairline,
      borderColor: c.border,
      gap: Space.md,
      ...Shadow.card,
    },
    selectorRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    versus: { ...Type.caption, color: c.textSub },
    chart: { width: '100%', aspectRatio: CHART_W / CHART_H },
    legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.xs },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
    legendBar: { width: 14, height: 3, borderRadius: 2 },
    legendText: { ...Type.caption, color: c.textSub },
    readoutCard: {
      borderRadius: Radius.lg,
      padding: Space.lg,
      gap: Space.xs,
      borderWidth: Border.hairline,
    },
    readoutKicker: { ...Type.overline },
    readoutValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.base, flexWrap: 'wrap' },
    readoutValue: { ...Type.display, lineHeight: 38 },
    readoutBadge: {
      backgroundColor: c.card,
      paddingHorizontal: Space.md,
      paddingVertical: 4,
      borderRadius: Radius.pill,
      borderWidth: Border.hairline,
    },
    readoutBadgeText: { ...Type.overline },
    readoutHeadline: { ...Type.bodyMd, fontWeight: Weight.semibold, lineHeight: 20 },
    readoutMuted: { ...Type.caption, color: c.textMuted },
    empty: { ...Type.bodyMd, color: c.textSub, textAlign: 'center', paddingVertical: Space.lg },
  });
}

/**
 * Build an SVG path from a normalized series, breaking the line wherever a
 * null value appears so we don't bridge across missing days.
 */
function buildLinePath(values: (number | null)[]): string {
  if (values.length === 0) return '';
  const innerW = CHART_W - CHART_PAD * 2;
  const innerH = CHART_H - CHART_PAD * 2;
  const denom = values.length === 1 ? 1 : values.length - 1;

  let d = '';
  let pen = 'M';
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      pen = 'M';
      continue;
    }
    const x = CHART_PAD + (i / denom) * innerW;
    const y = CHART_H - CHART_PAD - v * innerH;
    d += `${pen} ${x.toFixed(1)} ${y.toFixed(1)} `;
    pen = 'L';
  }
  return d.trim();
}

/**
 * Build a filled-area path (line + baseline closure). Each contiguous non-null
 * segment becomes its own closed sub-path so gaps don't paint a phantom area.
 */
function buildAreaPath(values: (number | null)[]): string {
  if (values.length === 0) return '';
  const innerW = CHART_W - CHART_PAD * 2;
  const innerH = CHART_H - CHART_PAD * 2;
  const denom = values.length === 1 ? 1 : values.length - 1;
  const baselineY = CHART_H - CHART_PAD;

  let d = '';
  let i = 0;
  while (i < values.length) {
    if (values[i] === null) { i++; continue; }
    const startI = i;
    let segment = '';
    while (i < values.length) {
      const v = values[i];
      if (v === null) break;
      const x = CHART_PAD + (i / denom) * innerW;
      const y = CHART_H - CHART_PAD - v * innerH;
      segment += `${i === startI ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
      i++;
    }
    const lastI = i - 1;
    // Skip degenerate single-point segments — no fillable area.
    if (lastI === startI) continue;
    const xLast = CHART_PAD + (lastI / denom) * innerW;
    const xFirst = CHART_PAD + (startI / denom) * innerW;
    segment += `L ${xLast.toFixed(1)} ${baselineY} L ${xFirst.toFixed(1)} ${baselineY} Z `;
    d += segment;
  }
  return d.trim();
}

function findExistingFinding(findings: Finding[], aId: string, bId: string): Finding | undefined {
  return findings.find((f) =>
    (f.trackerA.id === aId && f.trackerB.id === bId)
    || (f.trackerA.id === bId && f.trackerB.id === aId)
  );
}

function strengthLabel(weight: number): string {
  if (weight >= 0.7) return 'strong';
  if (weight >= 0.4) return 'moderate';
  return 'weak';
}

function fmtPrimary(f: Finding): string {
  const v = f.primary;
  if (f.kind === 'bin-bin') {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${Math.round(v * 100)}%`;
  }
  const sign = v >= 0 ? '+' : '';
  if (Math.abs(v) >= 10) return `${sign}${v.toFixed(1)}`;
  return `${sign}${v.toFixed(2)}`;
}

interface OverlayViewProps {
  /** Override for the trailing window in days. Defaults to 30 to match the heatmap. */
  windowDays?: number;
}

export function OverlayView({ windowDays = 30 }: OverlayViewProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { trackers, entriesByTrackerByDay } = useTrackers();
  const { findings } = useCorrelations();
  const { today } = useCurrentDay();
  // Frame 4 in the staggered mount sequence; bottom-most widget and typically
  // off-screen on first paint anyway.
  const mounted = useDeferMount(4);

  // Eligible defaults: daily-frequency trackers (matches the engine's filter).
  const dailyTrackers = useMemo(
    () => trackers.filter((t) => trackerInterval(t) === 1),
    [trackers],
  );

  // Initial pair: top finding, else first two daily-eligible trackers, else
  // first two of any kind. Computed once at mount via lazy state init so the
  // user's explicit pick is never overwritten when `findings` re-resolves.
  const initialPair = (): { a: string | null; b: string | null } => {
    if (findings.length > 0) return { a: findings[0].trackerA.id, b: findings[0].trackerB.id };
    if (dailyTrackers.length >= 2) return { a: dailyTrackers[0].id, b: dailyTrackers[1].id };
    if (trackers.length >= 2) return { a: trackers[0].id, b: trackers[1].id };
    return { a: null, b: null };
  };
  const [aId, setAId] = useState<string | null>(() => initialPair().a);
  const [bId, setBId] = useState<string | null>(() => initialPair().b);

  // If still null (initial render had no trackers loaded yet), adopt the
  // first available pair the moment trackers/findings show up.
  const effectiveAId = aId ?? (findings[0]?.trackerA.id ?? dailyTrackers[0]?.id ?? trackers[0]?.id ?? null);
  const effectiveBId = (() => {
    const fallback = findings[0]?.trackerB.id ?? dailyTrackers[1]?.id ?? trackers[1]?.id ?? null;
    const candidate = bId ?? fallback;
    // Avoid same-tracker selection on both sides; pick the next distinct one.
    if (candidate && candidate === effectiveAId) {
      return trackers.find((t) => t.id !== effectiveAId)?.id ?? candidate;
    }
    return candidate;
  })();

  // When the user picks the same tracker for the other slot, swap rather than
  // collapsing both selectors onto one tracker.
  const handleChangeA = useCallback((id: string) => {
    setAId(id);
    setBId((prev) => (prev === id ? effectiveAId : prev));
  }, [effectiveAId]);
  const handleChangeB = useCallback((id: string) => {
    setBId(id);
    setAId((prev) => (prev === id ? effectiveBId : prev));
  }, [effectiveBId]);

  const dayKeys = useMemo(() => lastNDayKeys(today, windowDays), [today, windowDays]);

  const ta: Tracker | undefined = effectiveAId ? trackers.find((t) => t.id === effectiveAId) : undefined;
  const tb: Tracker | undefined = effectiveBId ? trackers.find((t) => t.id === effectiveBId) : undefined;

  // Narrow deps to the per-tracker entry slice so an unrelated tracker edit
  // doesn't recompute these series.
  const entriesA = ta ? entriesByTrackerByDay[ta.id] : undefined;
  const entriesB = tb ? entriesByTrackerByDay[tb.id] : undefined;

  const seriesA = useMemo(() => {
    if (!ta) return [];
    return buildNormalizedSeries(ta, dayKeys, entriesA ?? {});
  }, [ta, dayKeys, entriesA]);

  const seriesB = useMemo(() => {
    if (!tb) return [];
    return buildNormalizedSeries(tb, dayKeys, entriesB ?? {});
  }, [tb, dayKeys, entriesB]);

  const finding = useMemo(() => {
    if (!ta || !tb) return undefined;
    return findExistingFinding(findings, ta.id, tb.id);
  }, [findings, ta, tb]);

  if (trackers.length < 2 || !ta || !tb) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Overlay</Text>
          <Text style={styles.helper}>Compare two trackers on a shared timeline.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.empty}>Add at least two trackers to compare.</Text>
        </View>
      </View>
    );
  }

  // Skeleton on first paint — same outer chrome so layout stays stable when
  // the chart and readout swap in.
  if (!mounted) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Overlay</Text>
          <Text style={styles.helper}>Compare two trackers on a shared timeline.</Text>
        </View>
        <View style={styles.card}>
          <Skeleton style={styles.chart} />
        </View>
      </View>
    );
  }

  const colorA = getTrackerColorHex(ta.color);
  const colorB = getTrackerColorHex(tb.color);
  const fillA = getTrackerColorRgba(ta.color, 0.15);
  const fillB = getTrackerColorRgba(tb.color, 0.15);

  const positive = finding ? finding.primary >= 0 : true;
  const ink = positive ? POSITIVE_INK : NEGATIVE_INK;
  const bg = positive ? POSITIVE_BG : NEGATIVE_BG;
  const border = positive ? POSITIVE_BORDER : NEGATIVE_BORDER;

  const linePathA = buildLinePath(seriesA);
  const linePathB = buildLinePath(seriesB);
  const areaPathA = buildAreaPath(seriesA);
  const areaPathB = buildAreaPath(seriesB);

  const gridYs = [0.25, 0.5, 0.75].map((g) => CHART_H - CHART_PAD - g * (CHART_H - CHART_PAD * 2));

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.header}>Overlay</Text>
        <Text style={styles.helper}>Two trackers, one timeline. Last {windowDays} days, normalized.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.selectorRow}>
          <TrackerSelect trackers={trackers} value={ta.id} onChange={handleChangeA} />
          <Text style={styles.versus}>vs</Text>
          <TrackerSelect trackers={trackers} value={tb.id} onChange={handleChangeB} />
        </View>

        <View style={styles.chart}>
          <Svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height="100%">
            {gridYs.map((y) => (
              <Line
                key={y}
                x1={CHART_PAD} x2={CHART_W - CHART_PAD}
                y1={y} y2={y}
                stroke={c.border}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            ))}
            {areaPathA !== '' && <Path d={areaPathA} fill={fillA} />}
            {areaPathB !== '' && <Path d={areaPathB} fill={fillB} />}
            {linePathA !== '' && (
              <Path d={linePathA} fill="none" stroke={colorA} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {linePathB !== '' && (
              <Path d={linePathB} fill="none" stroke={colorB} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Svg>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colorA }]} />
            <Text style={styles.legendText} numberOfLines={1}>{ta.name}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colorB }]} />
            <Text style={styles.legendText} numberOfLines={1}>{tb.name}</Text>
          </View>
        </View>
      </View>

      {finding ? (
        <View style={[styles.readoutCard, { backgroundColor: bg, borderColor: border }]}>
          <Text style={[styles.readoutKicker, { color: ink }]}>Correlation</Text>
          <View style={styles.readoutValueRow}>
            <Text style={[styles.readoutValue, { color: ink }]}>{fmtPrimary(finding)}</Text>
            <View style={[styles.readoutBadge, { borderColor: border }]}>
              <Text style={[styles.readoutBadgeText, { color: ink }]}>
                {strengthLabel(findingWeight(finding))}
              </Text>
            </View>
          </View>
          <Text style={[styles.readoutHeadline, { color: ink }]}>{finding.headline}</Text>
          <Text style={styles.readoutMuted}>n = {finding.n} days</Text>
        </View>
      ) : (
        <View style={[styles.readoutCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.readoutKicker, { color: c.textMuted }]}>Correlation</Text>
          <Text style={[styles.readoutHeadline, { color: c.textSub }]}>
            Not a strong enough pattern to call yet.
          </Text>
          <Text style={styles.readoutMuted}>
            Keep logging — patterns appear once both trackers have ~14+ overlapping days.
          </Text>
        </View>
      )}
    </View>
  );
}
