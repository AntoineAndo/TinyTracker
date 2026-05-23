// Card UI for a single routine - displays its name, time window, tracker rows, and a "Mark all done" action.
// Completed rows transition to their "done" state (CompletedValue / checked checkbox) in place; the
// card itself stays mounted all day so the user can see what they've finished.
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { Border, Radius, Space, Type } from '@/constants/tokens';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { COMPLETION_CELEBRATION_MS, isRoutineTrackerCompleted } from '@/lib/tracker-utils';
import { Entry, Routine, Tracker } from '@/lib/types';
import { hexToRgb } from '@/lib/utils';

type RoutineCardProps = {
  routine: Routine;
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  /** [trackerId] = amount this routine has contributed to count trackers in the current period */
  progressMap: Record<string, number>;
  isActive: boolean;
  isDone: boolean;
  /** True when this routine has any current-period progress that could be undone. */
  hasProgress: boolean;
  onMarkAllDone: () => void;
  onReset: () => void;
  onSave: (tracker: Tracker, value: number) => void;
  onComplete: (tracker: Tracker) => void;
};

// Pick an emoji based on the routine's start hour
function routineEmoji(startHour: number): string {
  if (startHour < 12) return '🌅';
  if (startHour < 17) return '☀️';
  return '🌙';
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function makeStyles(c: AppTheme) {
  const { r, g, b } = hexToRgb(c.tint);
  const borderColor = `rgba(${r},${g},${b},0.25)`;
  const rowBg = c.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';

  return StyleSheet.create({
    card: {
      marginHorizontal: Space.lg,
      marginBottom: Space.md,
      borderRadius: Radius.xl,
      borderWidth: Border.hairline,
      borderColor,
      overflow: 'hidden',
      shadowColor: '#FFA34F',
      elevation: 5,
    },
    cardInner: {
      padding: Space.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.base,
      marginBottom: Space.base,
    },
    emoji: { fontSize: 26 },
    headerText: { flex: 1 },
    title: { ...Type.h2, color: c.text },
    subtitle: { ...Type.caption, color: c.textSub, marginTop: 2 },
    markAllBtn: {
      backgroundColor: c.text,
      paddingHorizontal: Space.lg,
      paddingVertical: Space.md,
      borderRadius: Radius.pill,
    },
    markAllBtnText: { ...Type.caption, fontWeight: '700', color: c.background },
    allDoneRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    allDoneText: { fontSize: 13, fontWeight: '700', color: '#22c55e' },
    resetBtn: {
      paddingHorizontal: Space.base,
      paddingVertical: Space.sm,
      borderRadius: Radius.pill,
      borderWidth: Border.hairline,
      borderColor: c.border,
    },
    resetBtnText: { ...Type.caption, fontWeight: '600', color: c.textSub },
    rowGap: { height: Space.md },
    row: {
      backgroundColor: rowBg,
      borderRadius: Radius.lg,
      paddingHorizontal: Space.base,
      paddingVertical: Space.base,
    },
  });
}

// Gradient stops per theme — warm coral-to-gold in light, darker tinted in dark
const GRADIENT_LIGHT: [string, string] = ['#FFE4DA', '#FCE9C4'];
const GRADIENT_DARK:  [string, string] = ['#3A1E18', '#3E2D0B'];

export function RoutineCard({ routine, trackers, entryMap, progressMap, isActive, isDone, hasProgress, onMarkAllDone, onReset, onSave, onComplete }: RoutineCardProps) {
  const c = useTheme();
  // The card auto-expands whenever it's inside its active time window. Outside the window
  // the user can tap the header to expand or collapse it manually.
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const expanded = isActive || manuallyExpanded;

  const toggleExpanded = useCallback(() => {
    if (isActive) return; // active routines stay open by definition
    setManuallyExpanded((v) => !v);
  }, [isActive]);
  const styles = useMemo(() => makeStyles(c), [c]);
  const gradientColors = c.scheme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

  // Rows that just completed and are showing the brief celebration before settling into
  // their final "done" presentation. Tracked in a ref so the cleanup timeout can be
  // cancelled on unmount.
  const [pendingDismissIds, setPendingDismissIds] = useState<Set<string>>(new Set());
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      dismissTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Confirm before resetting — reset deletes the current-period entry for non-count
  // trackers, so the user can't recover any boolean/log/range data they entered manually
  // outside this routine session.
  const confirmReset = useCallback(() => {
    Alert.alert(
      `Reset ${routine.name}?`,
      "This will undo this routine's progress for today.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onReset },
      ],
    );
  }, [routine.name, onReset]);

  const handleRowComplete = useCallback((tracker: Tracker) => {
    // Persist the completion immediately and flash the celebration; the row stays mounted
    // and switches to its done presentation when the timer clears.
    onComplete(tracker);

    const id = tracker.id;
    const existing = dismissTimers.current.get(id);
    if (existing) clearTimeout(existing);

    setPendingDismissIds((prev) => new Set([...prev, id]));
    const timer = setTimeout(() => {
      dismissTimers.current.delete(id);
      setPendingDismissIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, COMPLETION_CELEBRATION_MS);
    dismissTimers.current.set(id, timer);
  }, [onComplete]);

  // Count how many trackers in the routine are still pending. Trackers currently mid-
  // celebration are also counted as pending so the subtitle doesn't jump down before the
  // row has settled into its done state.
  const pendingCount = useMemo(
    () => trackers.filter((t) => {
      if (pendingDismissIds.has(t.id)) return true;
      const rt = routine.trackers.find((r) => r.id === t.id);
      return !isRoutineTrackerCompleted(t, entryMap[t.id], rt?.routineTarget, progressMap[t.id] ?? 0);
    }).length,
    [trackers, pendingDismissIds, routine.trackers, entryMap, progressMap],
  );

  const subtitle = isActive
    ? `Until ${formatTime(routine.endHour, routine.endMinute)} · ${pendingCount} left`
    : `${formatTime(routine.startHour, routine.startMinute)} – ${formatTime(routine.endHour, routine.endMinute)}`;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardInner}
      >
        <Pressable
          style={styles.header}
          onPress={toggleExpanded}
          // Active routines are always expanded — the press would be a no-op so skip the
          // pressed-state feedback entirely for that case.
          disabled={isActive}
        >
          <Text style={styles.emoji}>{routineEmoji(routine.startHour)}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{routine.name}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {isDone ? (
            <View style={styles.allDoneRow}>
              <Pressable style={styles.resetBtn} onPress={confirmReset}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Text style={styles.allDoneText}>All done ✓</Text>
            </View>
          ) : (
            <View style={styles.allDoneRow}>
              {hasProgress && (
                <Pressable style={styles.resetBtn} onPress={confirmReset}>
                  <Text style={styles.resetBtnText}>Reset</Text>
                </Pressable>
              )}
              <Pressable style={styles.markAllBtn} onPress={onMarkAllDone}>
                <Text style={styles.markAllBtnText}>Mark all ✓</Text>
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Outside the routine's time window the card is collapsed to its header. Tapping
            the header toggles `manuallyExpanded` so the user can peek at the trackers
            ahead/after the window. Active routines are always expanded. */}
        {expanded && <View>
          {trackers.map((tracker, index) => {
            const rt = routine.trackers.find((r) => r.id === tracker.id);
            return (
              <View key={tracker.id}>
                <View style={styles.row}>
                  <TrackerEntryRow
                    tracker={tracker}
                    entry={entryMap[tracker.id]}
                    streak={0}
                    showCompleted={true}
                    isPendingDismiss={pendingDismissIds.has(tracker.id)}
                    onSave={(value) => onSave(tracker, value)}
                    onComplete={() => handleRowComplete(tracker)}
                    variant="inset"
                    routineTarget={rt?.routineTarget}
                    routineProgress={progressMap[tracker.id] ?? 0}
                  />
                </View>
                {index < trackers.length - 1 && <View style={styles.rowGap} />}
              </View>
            );
          })}
        </View>}
      </LinearGradient>
    </View>
  );
}
