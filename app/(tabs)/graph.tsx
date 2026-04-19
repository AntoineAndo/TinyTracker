import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EditEntryDrawer } from '@/components/edit-entry-drawer';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { useSettings } from '@/context/settings-context';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { Entry, Tracker } from '@/lib/types';
import { getLogicalDay, hexToRgb, isSameDay, trackerInterval } from '@/lib/utils';

// ── Layout constants ───────────────────────────────────────────────────────────

const CELL = 28;
const CELL_GAP = 0;
const CELL_STEP = CELL + CELL_GAP;
const LEFT_WIDTH = 130;
const ROW_HEIGHT = CELL + CELL_GAP * 2;
const HEADER_HEIGHT = 44;

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
  entryMap: Record<string, Record<string, Entry>>,
): PeriodCell[] {
  const interval = trackerInterval(tracker);
  const DAY = 86400000;
  const wsTime = windowStart.getTime();

  // Build a flat lookup: day offset → Entry
  const entryAtOffset: (Entry | undefined)[] = new Array(totalDays).fill(undefined);
  for (let i = 0; i < totalDays; i++) {
    const dayStr = new Date(wsTime + i * DAY).toDateString();
    const e = entryMap[tracker.id]?.[dayStr];
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    screenTitle: { fontSize: 28, fontWeight: '700', color: c.text },
    gridWrapper: { flex: 1, flexDirection: 'row' },
    leftCol: {
      width: LEFT_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.border,
      paddingLeft: 16,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
    nameDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    nameText: { fontSize: 13, fontWeight: '600', color: c.text, flexShrink: 1 },
    scrollArea: { flex: 1 },
    scrollContent: { paddingHorizontal: 8 },
    dateHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 6 },
    dateCell: { alignItems: 'center', justifyContent: 'flex-end' },
    monthLabel: {
      fontSize: 9, fontWeight: '700', color: c.textSub,
      textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1,
    },
    dayLabel: { fontSize: 10, color: c.textMuted, fontWeight: '500' },
    dayLabelToday: { color: c.tint, fontWeight: '700' },
    cellRow: { flexDirection: 'row', alignItems: 'center' },
    cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    cellEmpty: { borderWidth: 1, borderColor: c.cellEmpty },
    cellNumber: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
    cellIndicator: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtext: { fontSize: 15, color: c.textSub },
  });
}

// ── Cell ───────────────────────────────────────────────────────────────────────

function Cell({ tracker, entry, styles, logScale, isCurrentDay, onPress, showValues, widthDays = 1 }: {
  tracker: Tracker;
  entry: Entry | undefined;
  styles: ReturnType<typeof makeStyles>;
  logScale?: { min: number; max: number };
  isCurrentDay?: boolean;
  onPress?: () => void;
  showValues?: boolean;
  widthDays?: number;
}) {
  const hex = getTrackerColorHex(tracker.color);
  const w = widthDays > 1 ? { width: widthDays * CELL_STEP } : undefined;

  if (!entry) return <Pressable onPress={onPress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;

  const numValue = typeof entry.value === 'boolean' ? (entry.value ? 1 : 0) : entry.value as number;
  const { r, g, b } = hexToRgb(hex);

  if (tracker.type === 'boolean') {
    if (numValue === 0) return <Pressable onPress={onPress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;
    return <Pressable onPress={onPress}><View style={[styles.cell, { backgroundColor: hex }, w]} /></Pressable>;
  }

  if (tracker.type === 'count') {
    const target = tracker.target ?? 1;
    if (numValue === 0) return <Pressable onPress={onPress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;
    const opacity = (numValue / target) * 0.9 + 0.1;
    const textColor = numValue < target ? hex : '#fff';
    return (
      <Pressable onPress={onPress}>
        <View style={[styles.cell, { backgroundColor: `rgba(${r},${g},${b},${opacity})` }, w]}>
          {showValues && <Text style={[styles.cellNumber, { color: textColor }]}>{numValue}</Text>}
        </View>
      </Pressable>
    );
  }

  if (tracker.type === 'log') {
    const isComplete = entry.completed === true;

    if (numValue === 0 && !isComplete) return <Pressable onPress={onPress}><View style={[styles.cell, styles.cellEmpty, w]} /></Pressable>;

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
      <Pressable onPress={onPress}>
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
    <Pressable onPress={onPress}>
      <View style={[styles.cell, { backgroundColor: `rgba(${r},${g},${b},${opacity})` }, w]}>
        {showValues && <Text style={[styles.cellNumber, { color: textColor }]}>{numValue}</Text>}
      </View>
    </Pressable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type EditingState = { tracker: Tracker; day: Date; entry: Entry | undefined };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GraphScreen() {
  const { trackers, entries, addEntryForDate, updateEntry, deleteEntry } = useTrackers();
  const { graphShowValues } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { today } = useCurrentDay();
  const [editing, setEditing] = useState<EditingState | null>(null);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);

  const days = generateDays(startDate, today);

  const entryMap: Record<string, Record<string, Entry>> = {};
  for (const entry of entries) {
    if (!entryMap[entry.trackerId]) entryMap[entry.trackerId] = {};
    entryMap[entry.trackerId][getLogicalDay(new Date(entry.createdAt), entry.dayStartHour ?? 0).toDateString()] = entry;
  }

  // Precompute min/max scale per log tracker across the 30-day window
  const logScales: Record<string, { min: number; max: number }> = {};
  for (const tracker of trackers) {
    if (tracker.type !== 'log') continue;
    const trackerEntries = entryMap[tracker.id] ?? {};
    const values = days
      .map((d) => trackerEntries[d.toDateString()])
      .filter((e): e is Entry => !!e && (e.value as number) > 0)
      .map((e) => e.value as number);
    if (values.length === 0) {
      logScales[tracker.id] = { min: 0, max: 1 };
    } else {
      logScales[tracker.id] = { min: Math.min(...values), max: Math.max(...values) };
    }
  }

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, []);

  if (trackers.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No trackers yet.</Text>
        <Text style={styles.emptySubtext}>Create a tracker to see data here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Graph</Text>
      </View>

      <View style={styles.gridWrapper}>
        <View style={styles.leftCol}>
          <View style={{ height: HEADER_HEIGHT }} />
          {trackers.map((tracker) => {
            const hex = getTrackerColorHex(tracker.color);
            return (
              <View key={tracker.id} style={[styles.nameRow, { height: ROW_HEIGHT }]}>
                <View style={[styles.nameDot, { backgroundColor: hex }]} />
                <Text style={styles.nameText} numberOfLines={1}>{tracker.name}</Text>
              </View>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}>
          <View>
            <View style={[styles.dateHeader, { height: HEADER_HEIGHT }]}>
              {days.map((day, i) => {
                const prevDay = i > 0 ? days[i - 1] : null;
                const showMonth = i === 0 || (prevDay != null && day.getMonth() !== prevDay.getMonth());
                const isToday = isSameDay(day, today);
                return (
                  <View key={i} style={[styles.dateCell, { width: CELL_STEP }]}>
                    {showMonth && <Text style={styles.monthLabel}>{MONTHS[day.getMonth()]}</Text>}
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {DAYS[day.getDay()]}
                    </Text>
                  </View>
                );
              })}
            </View>

            {trackers.map((tracker) => {
              if (tracker.reminderFrequency === 'daily') {
                return (
                  <View key={tracker.id} style={[styles.cellRow, { height: ROW_HEIGHT }]}>
                    {days.map((day, i) => {
                      const entry = entryMap[tracker.id]?.[day.toDateString()];
                      const isToday = isSameDay(day, today);
                      return (
                        <View key={i} style={{ width: CELL_STEP, alignItems: 'flex-start', justifyContent: 'center', height: ROW_HEIGHT }}>
                          <Cell
                            tracker={tracker}
                            entry={entry}
                            styles={styles}
                            logScale={logScales[tracker.id]}
                            isCurrentDay={isToday}
                            onPress={() => setEditing({ tracker, day, entry })}
                            showValues={graphShowValues}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              }

              // Weekly / custom: period-based cells
              const periodCells = computePeriodCells(tracker, days[0], days.length, entryMap);
              return (
                <View key={tracker.id} style={[styles.cellRow, { height: ROW_HEIGHT }]}>
                  {periodCells.map((cell, i) => (
                    <View key={i} style={{ width: cell.widthDays * CELL_STEP, alignItems: 'flex-start', justifyContent: 'center', height: ROW_HEIGHT }}>
                      <Cell
                        tracker={tracker}
                        entry={cell.entry}
                        styles={styles}
                        logScale={logScales[tracker.id]}
                        onPress={() => setEditing({ tracker, day: cell.periodStart, entry: cell.entry })}
                        showValues={graphShowValues}
                        widthDays={cell.widthDays}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {editing && (() => {
        const { tracker, day, entry } = editing;
        const stubEntry: Entry = entry ?? {
          id: '',
          trackerId: tracker.id,
          value: tracker.type === 'boolean' ? 0 : 0,
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
