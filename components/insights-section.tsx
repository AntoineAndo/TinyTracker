// Patterns block rendered below the graph grid. Pulls insights from
// useInsights (pairwise findings + single-tracker trends merged into one
// ranked feed) and lays them out as headline cards: tracker icon(s) + arrow
// on top, plain-English headline in the body, and a sample-size footer.
// Owns the loading skeleton and the empty-state copy.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Shadow, Size, Space, Type } from '@/constants/tokens';
import { useDeferMount } from '@/hooks/use-defer-mount';
import { useInsights } from '@/hooks/use-insights';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { Finding } from '@/lib/correlations';
import { Insight, insightId } from '@/lib/insights';
import { getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { TrendInsight } from '@/lib/trends';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: Space.xl,
      paddingTop: Space.section,
      paddingBottom: Space['2xl'],
      gap: Space.lg,
    },
    headerBlock: { gap: Space.xs },
    header: { ...Type.label, color: c.text },
    helper: { ...Type.caption, color: c.textMuted },
    cards: { gap: Space.base },
    card: {
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.lg,
      gap: Space.md,
      ...Shadow.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
    iconBlock: {
      width: Size.iconBgSm,
      height: Size.iconBgSm,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: { fontSize: 16 },
    arrow: { ...Type.body, color: c.textMuted },
    spacer: { flex: 1 },
    chip: {
      paddingHorizontal: Space.md,
      paddingVertical: Space.xs,
      borderRadius: Radius.pill,
    },
    chipText: { ...Type.caption, color: c.text },
    headline: { ...Type.body, color: c.text },
    footer: { ...Type.caption, color: c.textMuted },
    empty: {
      ...Type.bodyMd,
      color: c.textSub,
      textAlign: 'center',
      paddingVertical: Space.lg,
    },
    skeleton: { height: 96 },
  });
}

function fmtSignedNumber(x: number): string {
  const sign = x >= 0 ? '+' : '';
  if (Math.abs(x) >= 100) return `${sign}${Math.round(x)}`;
  if (Math.abs(x) >= 10) return `${sign}${x.toFixed(1)}`;
  return `${sign}${x.toFixed(2)}`;
}

function pairChipText(f: Finding): string {
  if (f.kind === 'cont-cont') {
    return `ρ ${fmtSignedNumber(f.primary)}`;
  }
  if (f.kind === 'bin-bin' && f.proportions) {
    const delta = (f.proportions.pIfA - f.proportions.pIfNotA) * 100;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${Math.round(delta)}%`;
  }
  if (f.kind === 'bin-cont' && f.conditionalMeans) {
    const delta = f.conditionalMeans.onA - f.conditionalMeans.offA;
    return fmtSignedNumber(delta);
  }
  return '';
}

function trendChipText(t: TrendInsight): string {
  if (t.kind === 'trend-recent' && t.recentVsBaseline) {
    // Show the magnitude only; the headline carries the better/worse qualifier
    // so the chip and headline cannot disagree in sign for "lower-is-better"
    // trackers (where a negative raw delta is actually a positive outcome).
    const pct = Math.round(Math.abs(t.recentVsBaseline.pctChange) * 100);
    const direction = t.primary > 0 ? '↑' : '↓';
    return `${direction} ${pct}%`;
  }
  // streak
  return `${t.primary}d`;
}

function PairCard({ finding, styles }: { finding: Finding; styles: ReturnType<typeof makeStyles> }) {
  const aBg = getTrackerColorRgba(finding.trackerA.color, 0.18);
  const bBg = getTrackerColorRgba(finding.trackerB.color, 0.18);
  const chipBg = getTrackerColorRgba(finding.trackerA.color, 0.12);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBlock, { backgroundColor: aBg }]}>
          <Text style={styles.iconText}>{getTrackerIcon(finding.trackerA.icon)}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={[styles.iconBlock, { backgroundColor: bBg }]}>
          <Text style={styles.iconText}>{getTrackerIcon(finding.trackerB.icon)}</Text>
        </View>
        <View style={styles.spacer} />
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={styles.chipText}>{pairChipText(finding)}</Text>
        </View>
      </View>
      <Text style={styles.headline}>{finding.headline}</Text>
      <Text style={styles.footer}>n = {finding.n} days</Text>
    </View>
  );
}

function TrendCard({ trend, styles }: { trend: TrendInsight; styles: ReturnType<typeof makeStyles> }) {
  const iconBg = getTrackerColorRgba(trend.tracker.color, 0.18);
  const chipBg = getTrackerColorRgba(trend.tracker.color, 0.12);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBlock, { backgroundColor: iconBg }]}>
          <Text style={styles.iconText}>{getTrackerIcon(trend.tracker.icon)}</Text>
        </View>
        <View style={styles.spacer} />
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={styles.chipText}>{trendChipText(trend)}</Text>
        </View>
      </View>
      <Text style={styles.headline}>{trend.headline}</Text>
      <Text style={styles.footer}>
        {trend.kind === 'trend-streak' ? `${trend.n}-day run` : `n = ${trend.n} days`}
      </Text>
    </View>
  );
}

function InsightCard({ insight, styles }: { insight: Insight; styles: ReturnType<typeof makeStyles> }) {
  if (insight.kind === 'pair') return <PairCard finding={insight.finding} styles={styles} />;
  return <TrendCard trend={insight.trend} styles={styles} />;
}

export function InsightsSection() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Frame 2 in the staggered mount sequence (grid=1, this=2, constellation=3,
  // overlay=4). One heavy widget per frame instead of one giant blocking mount.
  const mounted = useDeferMount(2);
  const { insights, ready, loading } = useInsights();

  // Show the skeleton until both the deferred mount fires AND the correlation
  // engine has finished its chunk-load loop. Either being incomplete means
  // the section can't render real content yet.
  const showSkeleton = !mounted || (!ready && loading);
  const showEmpty = mounted && ready && insights.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.header}>Patterns</Text>
        <Text style={styles.helper}>
          Connections we noticed across your last 180 days of logs.
        </Text>
      </View>
      <View style={styles.cards}>
        {showSkeleton && <Skeleton style={styles.skeleton} />}
        {showEmpty && (
          <Text style={styles.empty}>
            Log a few more days across multiple trackers and patterns will appear here.
          </Text>
        )}
        {insights.map((i) => (
          <InsightCard
            key={insightId(i)}
            insight={i}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}
