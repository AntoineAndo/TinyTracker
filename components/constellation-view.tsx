// Constellation: a circular layout of every tracker with edges drawn between
// pairs that the correlation engine flagged as significant. Solid edges =
// "moves together" (positive primary), dashed edges = "opposite" (negative
// primary). Edge thickness/opacity scale with effect size via findingWeight.
// Tap a node to focus on its incident edges; tap the same node to clear.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { Skeleton } from '@/components/skeleton';
import { Border, Radius, Shadow, Space, Type } from '@/constants/tokens';
import { useTrackers } from '@/context/trackers-context';
import { useCorrelations } from '@/hooks/use-correlations';
import { useDeferMount } from '@/hooks/use-defer-mount';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { findingWeight } from '@/lib/correlations';
import { getTrackerColorHex, getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';

// Semantic SVG colors for edge polarity. Independent of theme accent colors.
const POSITIVE_COLOR = '#22c55e';
const NEGATIVE_COLOR = '#ef4444';

const VIEW_SIZE = 340;
const NODE_RADIUS = 22;
const RING_RADIUS = 120;

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { paddingHorizontal: Space.xl, paddingTop: Space.section, gap: Space.lg },
    headerBlock: { gap: Space.xs },
    header: { ...Type.label, color: c.text },
    helper: { ...Type.caption, color: c.textMuted },
    card: {
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.lg,
      borderWidth: Border.hairline,
      borderColor: c.border,
      ...Shadow.card,
    },
    canvas: { width: '100%', aspectRatio: 1 },
    legend: {
      flexDirection: 'row',
      gap: Space.lg,
      justifyContent: 'center',
      marginTop: Space.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
    legendBarSolid: { width: 18, height: 3, borderRadius: 2, backgroundColor: POSITIVE_COLOR },
    legendBarDashed: { width: 18, height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: NEGATIVE_COLOR },
    legendText: { ...Type.caption, color: c.textSub },
    footer: {
      ...Type.caption,
      color: c.textMuted,
      textAlign: 'center',
      paddingHorizontal: Space.lg,
    },
    empty: { ...Type.bodyMd, color: c.textSub, textAlign: 'center', paddingVertical: Space.lg },
  });
}

export function ConstellationView() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { trackers } = useTrackers();
  const { findings } = useCorrelations();
  // Frame 3 in the staggered mount sequence (grid=1, insights=2, this=3, overlay=4).
  const mounted = useDeferMount(3);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Position trackers on a circle around the SVG center (memoized).
  const positions = useMemo(() => {
    const cx = VIEW_SIZE / 2;
    const cy = VIEW_SIZE / 2;
    const map: Record<string, { x: number; y: number }> = {};
    const n = trackers.length;
    if (n === 0) return map;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      map[trackers[i].id] = {
        x: cx + Math.cos(angle) * RING_RADIUS,
        y: cy + Math.sin(angle) * RING_RADIUS,
      };
    }
    return map;
  }, [trackers]);

  // Pre-compute edge geometry.
  const edges = useMemo(() => {
    return findings
      .map((f) => {
        const p1 = positions[f.trackerA.id];
        const p2 = positions[f.trackerB.id];
        if (!p1 || !p2) return null;
        const w = findingWeight(f);
        const positive = f.primary >= 0;
        return {
          aId: f.trackerA.id,
          bId: f.trackerB.id,
          p1, p2,
          color: positive ? POSITIVE_COLOR : NEGATIVE_COLOR,
          dash: positive ? undefined : '4 5',
          width: 1 + w * 5,
          baseOpacity: 0.25 + w * 0.55,
          // Sort the IDs so a hypothetical A/B swap from the engine still
          // produces the same React key (no spurious remount).
          key: `${[f.trackerA.id, f.trackerB.id].sort().join('|')}-${f.kind}`,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [findings, positions]);

  const handleNodePress = useCallback((id: string) => {
    setFocusedId((prev) => (prev === id ? null : id));
  }, []);

  if (trackers.length < 2) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Constellation</Text>
          <Text style={styles.helper}>How your trackers cluster and connect.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.empty}>Add a few trackers to see how they connect.</Text>
        </View>
      </View>
    );
  }

  // Skeleton on first paint: same outer chrome (header + card) so layout
  // doesn't jump when the SVG canvas swaps in.
  if (!mounted) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Constellation</Text>
          <Text style={styles.helper}>How your trackers cluster and connect.</Text>
        </View>
        <View style={styles.card}>
          <Skeleton style={styles.canvas} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.header}>Constellation</Text>
        <Text style={styles.helper}>
          Trackers as nodes, correlations as links. Tap a node to focus.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.canvas}>
          <Svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} width="100%" height="100%">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={c.tint} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={c.tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={VIEW_SIZE / 2} cy={VIEW_SIZE / 2} r={RING_RADIUS + 30} fill="url(#halo)" />

            {edges.map((e) => {
              const dimmed = focusedId !== null && e.aId !== focusedId && e.bId !== focusedId;
              const opacity = dimmed ? 0.08 : e.baseOpacity;
              return (
                <Line
                  key={e.key}
                  x1={e.p1.x} y1={e.p1.y} x2={e.p2.x} y2={e.p2.y}
                  stroke={e.color}
                  strokeWidth={e.width}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  strokeDasharray={e.dash}
                />
              );
            })}

            {trackers.map((t) => {
              const p = positions[t.id];
              if (!p) return null;
              const fill = getTrackerColorRgba(t.color, 0.18);
              const stroke = getTrackerColorHex(t.color);
              const isFocused = focusedId === t.id;
              const isDimmed = focusedId !== null && !isFocused;
              return (
                <G key={t.id} onPress={() => handleNodePress(t.id)} opacity={isDimmed ? 0.45 : 1}>
                  <Circle
                    cx={p.x} cy={p.y} r={NODE_RADIUS}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isFocused ? 3 : 2}
                  />
                  <SvgText
                    x={p.x} y={p.y + 5}
                    textAnchor="middle"
                    fontSize={18}>
                    {getTrackerIcon(t.icon)}
                  </SvgText>
                  <SvgText
                    x={p.x} y={p.y + NODE_RADIUS + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="700"
                    fill={c.text}>
                    {t.name}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendBarSolid} />
            <Text style={styles.legendText}>moves together</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendBarDashed} />
            <Text style={styles.legendText}>opposite</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        Thicker lines mean a stronger relationship. Only patterns above the surfacing threshold are drawn.
      </Text>
    </View>
  );
}
