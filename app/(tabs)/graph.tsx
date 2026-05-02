// "Graph" tab: 30-day heat-grid of every tracker plus stacked alternative
// visualisations below — Patterns (plain-language correlations),
// Constellation (nodes+links view of the same correlations), and Overlay
// (two-tracker shared-timeline comparison). Every block reads from the same
// trackers-context day-pivot and useCorrelations result so they stay in sync.
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConstellationView } from '@/components/constellation-view';
import { TAB_BAR_HEIGHT } from '@/components/custom-tab-bar';
import { EditEntryDrawer } from '@/components/edit-entry-drawer';
import { InsightsSection } from '@/components/insights-section';
import { OverlayView } from '@/components/overlay-view';
import { FontFamily, Radius, Space, Type, Weight } from '@/constants/tokens';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { useDeferMount } from '@/hooks/use-defer-mount';
import { useSettings } from '@/context/settings-context';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { Entry, Tracker } from '@/lib/types';
import { hexToRgb, toDateString, trackerInterval } from '@/lib/utils';

// ── Layout constants ───────────────────────────────────────────────────────────

const CELL = 26;
const CELL_GAP = 4;
const CELL_STEP = CELL + CELL_GAP;
const LEFT_WIDTH = 140;
// 4px top + 4px bottom padding around each cell row
const ROW_HEIGHT = CELL + CELL_GAP * 2;
const HEADER_HEIGHT = 48;

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (d <= e) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}

type PeriodCell = { widthDays: number; entry: Entry | undefined; periodStart: Date };

/**
 * For a non-daily tracker, splits the window into period-sized cells.
 * Entry dates always start a new cell. A cell's width is at most `interval`
 * days, but is cut short when the next entry begins sooner.
 */
function computePeriodCells(
  tracker: Tracker,
  windowStart: Date,
  totalDays: number,
  trackerEntryMap: Record<string, Entry>,
): PeriodCell[] {
  const interval = trackerInterval(tracker);
  const DAY = 86400000;
  const wsTime = windowStart.getTime();

  // Build a flat lookup: day offset → Entry. Keys are YYYY-MM-DD to match
  // the lifted entriesByTrackerByDay pivot in trackers-context.
  const entryAtOffset: (Entry | undefined)[] = new Array(totalDays).fill(undefined);
  for (let i = 0; i < totalDays; i++) {
    const dayStr = toDateString(new Date(wsTime + i * DAY));
    const e = trackerEntryMap[dayStr];
    if (e) entryAtOffset[i] = e;
  }

  const cells: PeriodCell[] = [];
  let pos = 0;

  while (pos < totalDays) {
    const entry = entryAtOffset[pos];

    if (entry) {
      // Entry at this position — cell spans until the next entry starts (capped at interval).
      // This visually represents the period the entry "covers".
      let nextEntry: number | undefined;
      for (let i = pos + 1; i < Math.min(pos + interval, totalDays); i++) {
        if (entryAtOffset[i]) { nextEntry = i; break; }
      }
      const cellLen = Math.min(nextEntry !== undefined ? nextEntry - pos : interval, totalDays - pos);
      cells.push({ widthDays: cellLen, entry, periodStart: new Date(wsTime + pos * DAY) });
      pos += cellLen;
    } else {
      // No entry — single-day empty cell. Empty days don't span a period width
      // so the grid stays readable and only filled cells appear wide.
      cells.push({ widthDays: 1, entry: undefined, periodStart: new Date(wsTime + pos * DAY) });
      pos += 1;
    }
  }

  return cells;
}

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: Space.xl,
      paddingTop: Space.screenTop,
      paddingBottom: Space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    screenTitle:       { ...Type.display, color: c.text },
    screenTitleItalic: { fontFamily: FontFamily.displaySerifItalic },
    screenSubtitle:    { ...Type.caption, color: c.textMuted, marginTop: Space.xs },
    gridWrapper: { flexDirection: 'row' },
    leftCol: {
      width: LEFT_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.border,
      paddingLeft: Space.lg,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Space.base, paddingRight: Space.md },
    nameDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
    nameText: { fontSize: 13, fontWeight: Weight.semibold, color: c.text, flexShrink: 1 },
    scrollArea: { flex: 1 },
    scrollContent: { paddingHorizontal: Space.base },
    outerScrollContent: { paddingBottom: TAB_BAR_HEIGHT },
    dateHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: Space.xs },
    dateCell: { alignItems: 'center', justifyContent: 'flex-end' },
    monthLabel: {
      ...Type.overline, color: c.textSub, letterSpacing: 0.5, marginBottom: 2,
    },
    dayLabel: { fontSize: 10, color: c.textMuted, fontWeight: Weight.medium },
    dayLabelToday: { color: c.tint, fontWeight: Weight.bold },
    todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.tint, marginTop: 2 },
    cellRow: { flexDirection: 'row', alignItems: 'center' },
    // Base cell: filled rounded square — borders removed in favor of background fill
    cell: { width: CELL, height: CELL, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    cellEmpty: { backgroundColor: c.cellEmpty },
    cellNumber: { fontSize: 11, fontWeight: Weight.bold, textAlign: 'center' },
    cellIndicator: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md },
    emptyText: { fontSize: 18, fontWeight: Weight.semibold, color: c.text },
    emptySubtext: { ...Type.bodyMd, color: c.textSub },
  });
}

// ── Cell ───────────────────────────────────────────────────────────────────────

// Callback type shared between Cell and TrackerRow so the parent can hold one stable reference.
type OnCellPress = (tracker: Tracker, day: Date, entry: Entry | undefined) => void;

type CellProps = {
  tracker: Tracker;
  day: Date;
  entry: Entry | undefined;
  styles: ReturnType<typeof makeStyles>;
  logScale?: { min: number; max: number };
  isCurrentDay?: boolean;
  onCellPress: OnCellPress;
  showValues?: boolean;
  widthDays?: number;
};

// Memoized: re-renders only when this cell's entry, tracker, styles, logScale, or showValues
// changes. The stable onCellPress reference ensures editing-state changes in the parent
// never trigger a re-render here.
const Cell = React.memo(function Cell({
  tracker, day, entry, styles, logScale, isCurrentDay, onCellPress, showValues, widthDays = 1,
}: CellProps) {
  const handlePress = () => onCellPress(tracker, day, entry);
  const hex = getTrackerColorHex(tracker.color);
  // Subtract one gap so multi-day period cells don't eat into the trailing spacing
  const w = widthDays > 1 ? { width: widthDays * CELL_STEP - CELL_GAP } : undefined;

  if (!entry) return <Pressable onPress={handlePress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;

  const numValue = typeof entry.value === 'boolean' ? (entry.value ? 1 : 0) : entry.value as number;
  const { r, g, b } = hexToRgb(hex);

  if (tracker.type === 'boolean') {
    if (numValue === 0) return <Pressable onPress={handlePress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;
    return <Pressable onPress={handlePress}><View style={[styles.cell, { backgroundColor: hex }, w]} /></Pressable>;
  }

  if (tracker.type === 'count') {
    const target = tracker.target ?? 1;
    if (numValue === 0) return <Pressable onPress={handlePress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;
    const opacity = (numValue / target) * 0.9 + 0.1;
    const textColor = numValue < target ? hex : '#fff';
    return (
      <Pressable onPress={handlePress}>
        <View style={[styles.cell, { backgroundColor: `rgba(${r},${g},${b},${opacity})` }, w]}>
          {showValues && <Text style={[styles.cellNumber, { color: textColor }]}>{numValue}</Text>}
        </View>
      </Pressable>
    );
  }

  if (tracker.type === 'log') {
    const isComplete = entry.completed === true;

    if (numValue === 0 && !isComplete) return <Pressable onPress={handlePress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;

    const scaleMin = logScale?.min ?? 0;
    const scaleMax = logScale?.max ?? 1;
    const range = scaleMax - scaleMin;
    const relVal = range > 0 ? (numValue - scaleMin) / range : 0.5;
    const intensity = relVal * 0.8 + 0.2;
    const alpha = isComplete ? intensity : intensity * 0.35;

    const showMinWarning = tracker.min !== undefined
      && numValue < tracker.min
      && (!isCurrentDay || isComplete);
    const showMaxIndicator = tracker.max !== undefined && numValue >= tracker.max;

    return (
      <Pressable onPress={handlePress}>
        <View style={[styles.cell, { backgroundColor: `rgba(${r},${g},${b},${alpha})` }, w]}>
          {showMinWarning && (
            <View style={[styles.cellIndicator, { backgroundColor: '#f97316', bottom: 2, right: 2 }]} />
          )}
          {showMaxIndicator && (
            <View style={[styles.cellIndicator, { backgroundColor: '#fff', top: 2, right: 2 }]} />
          )}
        </View>
      </Pressable>
    );
  }

  // range type
  const effectiveValue = tracker.direction === 'down' ? (6 - numValue) : numValue;
  const opacity = ((effectiveValue - 1) / 4) * 0.9 + 0.1;
  const textColor = effectiveValue <= 2 ? hex : '#fff';
  return (
    <Pressable onPress={handlePress}>
      <View style={[styles.cell, { backgroundColor: `rgba(${r},${g},${b},${opacity})` }, w]}>
        {showValues && <Text style={[styles.cellNumber, { color: textColor }]}>{numValue}</Text>}
      </View>
    </Pressable>
  );
});

// ── TrackerRow ─────────────────────────────────────────────────────────────────

type TrackerRowProps = {
  tracker: Tracker;
  days: Date[];
  // Pre-computed day strings — avoids toDateString() calls inside the render loop
  dayStrings: string[];
  trackerEntryMap: Record<string, Entry>;
  todayString: string;
  // Unix timestamp of today — used to check if today falls inside a multi-day period cell
  todayTime: number;
  logScale?: { min: number; max: number };
  styles: ReturnType<typeof makeStyles>;
  showValues: boolean;
  onCellPress: OnCellPress;
};

// Memoized: skips re-render entirely when only the parent's editing state changes,
// which is the most frequent state change (tapping to open/close the edit drawer).
const TrackerRow = React.memo(function TrackerRow({
  tracker, days, dayStrings, trackerEntryMap, todayString, todayTime, logScale, styles, showValues, onCellPress,
}: TrackerRowProps) {
  const DAY_MS = 86400000;
  if (tracker.reminderFrequency === 'daily') {
    return (
      <View style={[styles.cellRow, { height: ROW_HEIGHT }]}>
        {days.map((day, i) => {
          const dayStr = dayStrings[i];
          return (
            <View key={day.toISOString()} style={{ width: CELL_STEP, height: ROW_HEIGHT, alignItems: 'flex-start', justifyContent: 'center' }}>
              <Cell
                tracker={tracker}
                day={day}
                entry={trackerEntryMap[dayStr]}
                styles={styles}
                logScale={logScale}
                isCurrentDay={dayStr === todayString}
                onCellPress={onCellPress}
                showValues={showValues}
              />
            </View>
          );
        })}
      </View>
    );
  }

  // Weekly / custom: period-based cells
  const periodCells = computePeriodCells(tracker, days[0], days.length, trackerEntryMap);
  return (
    <View style={[styles.cellRow, { height: ROW_HEIGHT }]}>
      {periodCells.map((cell) => {
        const periodStartTime = cell.periodStart.getTime();
        const isCurrentDay = todayTime >= periodStartTime && todayTime < periodStartTime + cell.widthDays * DAY_MS;
        return (
          <View key={cell.periodStart.toISOString()} style={{ width: cell.widthDays * CELL_STEP, height: ROW_HEIGHT, alignItems: 'flex-start', justifyContent: 'center' }}>
            <Cell
              tracker={tracker}
              day={cell.periodStart}
              entry={cell.entry}
              styles={styles}
              logScale={logScale}
              isCurrentDay={isCurrentDay}
              onCellPress={onCellPress}
              showValues={showValues}
              widthDays={cell.widthDays}
            />
          </View>
        );
      })}
    </View>
  );
});

// ── NameRow ────────────────────────────────────────────────────────────────────

// Memoized: only re-renders when the tracker's name/color or the theme changes.
const NameRow = React.memo(function NameRow({
  tracker, styles,
}: { tracker: Tracker; styles: ReturnType<typeof makeStyles> }) {
  const hex = getTrackerColorHex(tracker.color);
  return (
    <View style={[styles.nameRow, { height: ROW_HEIGHT }]}>
      <View style={[styles.nameDot, { backgroundColor: hex }]} />
      <Text style={styles.nameText} numberOfLines={1}>{tracker.name}</Text>
    </View>
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────────

type EditingState = { tracker: Tracker; day: Date; entry: Entry | undefined };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GraphScreen() {
  const { trackers, entriesByTrackerByDay, addEntryForDate, updateEntry, deleteEntry } = useTrackers();
  const { graphShowValues } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { today } = useCurrentDay();
  const [editing, setEditing] = useState<EditingState | null>(null);
  // Lifted constellation focus: tapping a node in ConstellationView filters
  // the InsightsSection below to only that tracker's connections. State lives
  // here so the two components stay in sync without a context.
  const [focusedTrackerId, setFocusedTrackerId] = useState<string | null>(null);

  const startDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return d;
  }, [today]);

  const days = useMemo(() => generateDays(startDate, today), [startDate, today]);

  // YYYY-MM-DD keys matching the lifted entriesByTrackerByDay pivot.
  const dayStrings = useMemo(() => days.map((d) => toDateString(d)), [days]);
  const todayString = useMemo(() => toDateString(today), [today]);
  const todayTime = useMemo(() => today.getTime(), [today]);

  const entryMap = entriesByTrackerByDay;

  // Precompute min/max scale per log tracker across the 30-day window
  const logScales = useMemo(() => {
    const scales: Record<string, { min: number; max: number }> = {};
    for (const tracker of trackers) {
      if (tracker.type !== 'log') continue;
      const trackerEntries = entryMap[tracker.id] ?? {};
      const values = dayStrings
        .map((s) => trackerEntries[s])
        .filter((e): e is Entry => !!e && (e.value as number) > 0)
        .map((e) => e.value as number);
      if (values.length === 0) {
        scales[tracker.id] = { min: 0, max: 1 };
      } else {
        scales[tracker.id] = { min: Math.min(...values), max: Math.max(...values) };
      }
    }
    return scales;
  }, [trackers, entryMap, dayStrings]);

  // Stable press handler — setEditing is guaranteed stable by React, so no deps needed.
  // This is the key to memoization: Cell and TrackerRow never see a new onCellPress reference.
  const handleCellPress = useCallback<OnCellPress>((tracker, day, entry) => {
    setEditing({ tracker, day, entry });
  }, []);

  // Stagger: paint the screen frame first, then mount the grid cells, then
  // each downstream widget on a later frame. Each widget shows a Skeleton
  // until its mount frame so the screen layout is stable from t=0.
  // delayFrames=1 (not 0) so that on cold tab swaps where InteractionManager
  // resolves same-tick, the screen chrome (header + name column) still gets
  // its own paint before the cells mount.
  const gridReady = useDeferMount(1);

  useFocusEffect(useCallback(() => {
    // Defer scrollToEnd one tick so the inner ScrollView has a measured width.
    // Track the timer so blurring the screen mid-delay doesn't poke a stale ref.
    // Gated on `gridReady` so we don't scroll the placeholder spacer (whose
    // width matches but whose mount precedes the real grid by one frame on
    // first visit) and end up at the wrong offset after the cells swap in.
    if (!gridReady) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(timer);
  }, [gridReady]));

  if (trackers.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No trackers yet.</Text>
        <Text style={styles.emptySubtext}>Create a tracker to see data here.</Text>
      </View>
    );
  }

  // Fixed grid height so the screen can scroll vertically with the Patterns
  // section below. Without this, the inner horizontal ScrollView would have
  // no defined height inside an outer vertical ScrollView.
  const gridHeight = HEADER_HEIGHT + trackers.length * ROW_HEIGHT;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Your <Text style={styles.screenTitleItalic}>history</Text></Text>
        <Text style={styles.screenSubtitle}>Last 30 days</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.outerScrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.gridWrapper, { height: gridHeight }]}>
          <View style={styles.leftCol}>
            <View style={{ height: HEADER_HEIGHT }} />
            {trackers.map((tracker) => (
              <NameRow key={tracker.id} tracker={tracker} styles={styles} />
            ))}
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}>
            {gridReady ? (
              <View>
                <View style={[styles.dateHeader, { height: HEADER_HEIGHT }]}>
                  {days.map((day, i) => {
                    const prevDay = i > 0 ? days[i - 1] : null;
                    const showMonth = i === 0 || (prevDay != null && day.getMonth() !== prevDay.getMonth());
                    const isToday = dayStrings[i] === todayString;
                    return (
                      <View key={day.toISOString()} style={[styles.dateCell, { width: CELL_STEP }]}>
                        {showMonth && <Text style={styles.monthLabel}>{MONTHS[day.getMonth()]}</Text>}
                        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                          {DAYS[day.getDay()]}
                        </Text>
                        {isToday && <View style={styles.todayDot} />}
                      </View>
                    );
                  })}
                </View>

                {trackers.map((tracker) => (
                  <TrackerRow
                    key={tracker.id}
                    tracker={tracker}
                    days={days}
                    dayStrings={dayStrings}
                    trackerEntryMap={entryMap[tracker.id] ?? {}}
                    todayString={todayString}
                    todayTime={todayTime}
                    logScale={logScales[tracker.id]}
                    styles={styles}
                    showValues={graphShowValues}
                    onCellPress={handleCellPress}
                  />
                ))}
              </View>
            ) : (
              // Invisible spacer matching the real grid's content size so the
              // horizontal ScrollView measures the same on first paint as it
              // will after the cells mount. No background or radius — the
              // user sees the screen chrome (date header + name column), not
              // a giant grey block where the cells will appear.
              <View
                style={{
                  width: days.length * CELL_STEP,
                  height: HEADER_HEIGHT + trackers.length * ROW_HEIGHT,
                }}
              />
            )}
          </ScrollView>
        </View>

        <ConstellationView focusedId={focusedTrackerId} onFocusChange={setFocusedTrackerId} />
        <InsightsSection focusedTrackerId={focusedTrackerId} />
        <OverlayView />
      </ScrollView>

      {editing && (() => {
        const { tracker, day, entry } = editing;
        const stubEntry: Entry = entry ?? {
          id: '',
          trackerId: tracker.id,
          value: 0,
          createdAt: day.toISOString(),
          dayStartHour: 0,
          completed: false,
        };
        const dayLabel = `${DAY_LABELS[day.getDay()]} ${MONTHS[day.getMonth()]} ${day.getDate()}`;
        return (
          <EditEntryDrawer
            tracker={tracker}
            entry={stubEntry}
            title={dayLabel}
            hideDelete={!entry}
            onSave={async (value) => {
              if (entry) {
                await updateEntry(entry.id, value);
              } else {
                await addEntryForDate(
                  { trackerId: tracker.id, value, completed: tracker.type === 'log' ? true : undefined },
                  day,
                );
              }
              setEditing(null);
            }}
            onDelete={async () => {
              if (entry) await deleteEntry(entry.id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        );
      })()}
    </View>
  );
}
