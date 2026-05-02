// Constellation: a force-directed layout of every tracker with edges drawn
// between pairs the correlation engine flagged as significant. Solid edges =
// "moves together" (positive primary), dashed edges = "opposite" (negative
// primary). Edge thickness/opacity scale with effect size via findingWeight.
// Strongly-correlated trackers naturally cluster closer together because the
// link force uses a distance inversely proportional to finding weight.
// Tap a node to focus on its incident edges; tap the same node to clear.

import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { Skeleton } from '@/components/skeleton';
import { Border, Radius, Shadow, Space, Type, Weight } from '@/constants/tokens';
import { useTrackers } from '@/context/trackers-context';
import { useCorrelations } from '@/hooks/use-correlations';
import { useDeferMount } from '@/hooks/use-defer-mount';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { findingWeight } from '@/lib/correlations';
import { computeConstellationLayout, type GraphEdge } from '@/lib/graph-layout';
import { getTrackerColorHex, getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';

// Semantic SVG colors for edge polarity. Independent of theme accent colors.
const POSITIVE_COLOR = '#22c55e';
const NEGATIVE_COLOR = '#ef4444';

const VIEW_SIZE = 340;
const NODE_RADIUS = 22;
// Padding kept around the canvas so labels and node circles stay inside the
// viewBox after the force simulation settles.
const LAYOUT_PAD = NODE_RADIUS + 18;
// Font sizes for SVG text inside nodes. Icon glyph is sized larger than the
// label to match the visual hierarchy on the canvas.
const NODE_ICON_SIZE = 18;
const NODE_LABEL_SIZE = Type.overline.fontSize;
// Legend bar dimensions: a 3px tall pill that mirrors the edge stroke style.
const LEGEND_BAR_W = 18;
const LEGEND_BAR_H = 3;

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
    canvas: { width: '100%', aspectRatio: 1, position: 'relative' },
    // Hit target overlays: one per node and one full-canvas to clear focus.
    // Sized in % of the square canvas so they line up with the SVG viewBox
    // regardless of the rendered pixel width.
    hitNode: { position: 'absolute', borderRadius: 999 },
    hitBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    legend: {
      flexDirection: 'row',
      gap: Space.lg,
      justifyContent: 'center',
      marginTop: Space.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
    legendBarSolid: { width: LEGEND_BAR_W, height: LEGEND_BAR_H, borderRadius: Radius.xs, backgroundColor: POSITIVE_COLOR },
    legendBarDashed: { width: LEGEND_BAR_W, height: 0, borderTopWidth: LEGEND_BAR_H, borderStyle: 'dashed', borderColor: NEGATIVE_COLOR },
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

export interface ConstellationViewProps {
  /** Currently focused tracker id, or null when nothing is selected. */
  focusedId: string | null;
  /** Notifies the parent when the focused tracker changes (or is cleared). */
  onFocusChange: (id: string | null) => void;
}

export function ConstellationView({ focusedId, onFocusChange }: ConstellationViewProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { trackers } = useTrackers();
  const { findings } = useCorrelations();
  // Frame 2 in the staggered mount sequence (grid=1, this=2, insights=3, overlay=4).
  const mounted = useDeferMount(2);

  // Structural fingerprints: the simulation only cares about node ids and
  // weighted edges, not the full tracker/finding objects. Recomputing only
  // when those structural keys change avoids re-running the 300-tick
  // simulation on every render where useCorrelations returns a new array.
  const trackerIds = useMemo(() => trackers.map((t) => t.id), [trackers]);
  const trackerIdsKey = useMemo(() => trackerIds.join('|'), [trackerIds]);
  const edgeInputs: GraphEdge[] = useMemo(
    () => findings.map((f) => ({ aId: f.trackerA.id, bId: f.trackerB.id, weight: findingWeight(f) })),
    [findings],
  );
  const edgeInputsKey = useMemo(
    () => edgeInputs.map((e) => `${e.aId}>${e.bId}:${e.weight.toFixed(3)}`).join('|'),
    [edgeInputs],
  );

  const positions = useMemo(
    () => computeConstellationLayout(trackerIds, edgeInputs, {
      size: VIEW_SIZE,
      pad: LAYOUT_PAD,
      collideRadius: NODE_RADIUS + 6,
    }),
    // Keys are derived from trackerIds/edgeInputs above; depending on the
    // strings keeps the layout stable when only references change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackerIdsKey, edgeInputsKey],
  );

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

  // Tap toggles: same node clears, different node switches.
  const handleNodePress = useCallback(
    (id: string) => {
      onFocusChange(focusedId === id ? null : id);
    },
    [focusedId, onFocusChange],
  );

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
          {/* Background tap target sits behind the SVG — only reachable when
              nothing else captures the touch, i.e. on empty canvas. Visible
              only when something is focused so it doesn't intercept taps that
              would otherwise pass through (e.g. accessibility tools). */}
          {focusedId !== null && (
            <Pressable
              style={styles.hitBackground}
              onPress={() => onFocusChange(null)}
            />
          )}
          <Svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={c.tint} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={c.tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={VIEW_SIZE / 2} cy={VIEW_SIZE / 2} r={VIEW_SIZE / 2} fill="url(#halo)" />

            {edges.map((e) => {
              const dimmed = focusedId !== null && e.aId !== focusedId && e.bId !== focusedId;
              // Connected edges keep their base intensity; unrelated edges
              // fade hard so the focused subgraph clearly stands out.
              const opacity = dimmed ? 0.05 : e.baseOpacity;
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
              const focusedFill = getTrackerColorRgba(t.color, 0.32);
              const stroke = getTrackerColorHex(t.color);
              const isFocused = focusedId === t.id;
              const isDimmed = focusedId !== null && !isFocused;
              const groupOpacity = isDimmed ? 0.3 : 1;
              return (
                <G key={t.id} opacity={groupOpacity}>
                  {/* Opaque base sits behind the tinted fill so edges passing
                      under the node aren't visible through the circle. */}
                  <Circle cx={p.x} cy={p.y} r={NODE_RADIUS} fill={c.card} />
                  <Circle
                    cx={p.x} cy={p.y} r={NODE_RADIUS}
                    fill={isFocused ? focusedFill : fill}
                    stroke={stroke}
                    strokeWidth={isFocused ? 3 : 2}
                  />
                  <SvgText
                    x={p.x} y={p.y + 5}
                    textAnchor="middle"
                    fontSize={NODE_ICON_SIZE}>
                    {getTrackerIcon(t.icon)}
                  </SvgText>
                  <SvgText
                    x={p.x} y={p.y + NODE_RADIUS + 14}
                    textAnchor="middle"
                    fontSize={NODE_LABEL_SIZE}
                    fontWeight={Weight.bold}
                    fill={c.text}>
                    {t.name}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Real Pressable hit targets layered on top of the SVG. Positioned
              in % so they line up with the viewBox regardless of canvas size.
              Using RN Pressables (not Svg onPress) gives us reliable taps and
              correct switching: tapping a different node fires its onPress
              and updates focus, instead of the SVG group eating the event. */}
          {trackers.map((t) => {
            const p = positions[t.id];
            if (!p) return null;
            const hitR = NODE_RADIUS + 10;
            const leftPct = ((p.x - hitR) / VIEW_SIZE) * 100;
            const topPct = ((p.y - hitR) / VIEW_SIZE) * 100;
            const sizePct = ((hitR * 2) / VIEW_SIZE) * 100;
            return (
              <Pressable
                key={t.id}
                style={[
                  styles.hitNode,
                  { left: `${leftPct}%`, top: `${topPct}%`, width: `${sizePct}%`, height: `${sizePct}%` },
                ]}
                onPress={() => handleNodePress(t.id)}
                hitSlop={6}
              />
            );
          })}
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
