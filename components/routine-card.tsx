// Card UI for a single routine - displays its name, time window, tracker rows, and a "Mark all done" action.
// Individual rows slide out (height collapse + fade) when their tracker completes, mirroring the today list behavior.
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedExitRow, ReboundTrigger, reboundDelay } from '@/components/animated-exit-row';
import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { Border, Radius, Space, Type } from '@/constants/tokens';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { COMPLETION_CELEBRATION_MS, isCompleted } from '@/lib/tracker-utils';
import { Entry, Routine, Tracker } from '@/lib/types';
import { hexToRgb } from '@/lib/utils';

type RoutineCardProps = {
  routine: Routine;
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  isActive: boolean;
  isDone: boolean;
  onMarkAllDone: () => void;
  onSave: (tracker: Tracker, value: number) => void;
  onComplete: (tracker: Tracker) => void;
  // Called when isDone is true and no row animations are in flight - parent should animate the card out
  onAllDone?: () => void;
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
    allDoneText: { fontSize: 13, fontWeight: '700', color: '#22c55e' },
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

export function RoutineCard({ routine, trackers, entryMap, isActive, isDone, onMarkAllDone, onSave, onComplete, onAllDone }: RoutineCardProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const gradientColors = c.scheme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;
  const animationsEnabled = useAnimationsEnabled();

  const [pendingDismissIds, setPendingDismissIds] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  // Rows fully animated out - kept hidden even though they remain in the trackers prop
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reboundMap, setReboundMap] = useState<Record<string, ReboundTrigger>>({});

  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reboundVersionsRef = useRef<Record<string, number>>({});
  const prevExitingRef = useRef(new Set<string>());
  // Tracks whether there was incomplete work this session; prevents onAllDone from
  // firing on mount when the routine was already completed before the user opened the app.
  const hadUndoneWork = useRef(!isDone);

  const visibleTrackers = useMemo(
    () => trackers.filter((t) => !hiddenIds.has(t.id)),
    [trackers, hiddenIds],
  );
  const visibleTrackersRef = useRef(visibleTrackers);
  visibleTrackersRef.current = visibleTrackers;

  // When a row starts exiting, spring-animate the siblings below it
  useEffect(() => {
    const newlyExiting = [...exitingIds].filter((id) => !prevExitingRef.current.has(id));
    if (newlyExiting.length === 0) {
      prevExitingRef.current = new Set(exitingIds);
      return;
    }

    const list = visibleTrackersRef.current;
    const updates: Record<string, ReboundTrigger> = {};

    for (const exitId of newlyExiting) {
      const exitIndex = list.findIndex((t) => t.id === exitId);
      if (exitIndex === -1) continue;
      list.forEach((t, i) => {
        if (i > exitIndex && !exitingIds.has(t.id)) {
          const version = (reboundVersionsRef.current[t.id] ?? 0) + 1;
          reboundVersionsRef.current[t.id] = version;
          updates[t.id] = { version, delay: reboundDelay(i - exitIndex - 1) };
        }
      });
    }

    if (Object.keys(updates).length > 0) {
      setReboundMap((prev) => ({ ...prev, ...updates }));
    }

    prevExitingRef.current = new Set(exitingIds);
  }, [exitingIds]);

  useEffect(() => {
    return () => {
      dismissTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Prune hiddenIds when a tracker is no longer completed (e.g. day rollover, entry edit)
  // so rows correctly reappear if the underlying data changes.
  useEffect(() => {
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        const t = trackers.find((tr) => tr.id === id);
        const rt = routine.trackers.find((r) => r.id === id);
        if (t && isCompleted(t, entryMap[id], rt?.routineTarget)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [trackers, entryMap, routine.trackers]);

  const handleRowComplete = useCallback((tracker: Tracker) => {
    // Persist the completion immediately, then drive the celebration + exit animation locally
    onComplete(tracker);

    const id = tracker.id;
    const existing = dismissTimers.current.get(id);
    if (existing) clearTimeout(existing);

    setPendingDismissIds((prev) => new Set([...prev, id]));
    const timer = setTimeout(() => {
      dismissTimers.current.delete(id);
      setPendingDismissIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setExitingIds((prev) => new Set([...prev, id]));
    }, COMPLETION_CELEBRATION_MS);
    dismissTimers.current.set(id, timer);
  }, [onComplete]);

  const handleExited = useCallback((id: string) => {
    setExitingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setHiddenIds((prev) => new Set([...prev, id]));
  }, []);

  // Signal the parent to remove the card once all done and no row animation is in flight.
  // Covers both paths: individual rows animated out and "Mark all done" pressed at once.
  // hadUndoneWork guards against firing on mount when the routine was already completed.
  useEffect(() => {
    if (!isDone) { hadUndoneWork.current = true; return; }
    if (hadUndoneWork.current && pendingDismissIds.size === 0 && exitingIds.size === 0) {
      hadUndoneWork.current = false;
      onAllDone?.();
    }
  }, [isDone, pendingDismissIds.size, exitingIds.size, onAllDone]);

  // Exclude animating/hidden trackers from the pending count shown in the subtitle
  const pendingCount = trackers.filter((t) => {
    if (hiddenIds.has(t.id) || pendingDismissIds.has(t.id) || exitingIds.has(t.id)) return false;
    const rt = routine.trackers.find((r) => r.id === t.id);
    return !isCompleted(t, entryMap[t.id], rt?.routineTarget);
  }).length;

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
        <View style={styles.header}>
          <Text style={styles.emoji}>{routineEmoji(routine.startHour)}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{routine.name}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {isDone ? (
            <Text style={styles.allDoneText}>All done ✓</Text>
          ) : (
            <Pressable
              style={styles.markAllBtn}
              onPress={onMarkAllDone}
            >
              <Text style={styles.markAllBtnText}>Mark all ✓</Text>
            </Pressable>
          )}
        </View>

        <View>
          {visibleTrackers.map((tracker, index) => {
            const rt = routine.trackers.find((r) => r.id === tracker.id);
            return (
              <AnimatedExitRow
                key={tracker.id}
                exiting={exitingIds.has(tracker.id)}
                onExited={() => handleExited(tracker.id)}
                animationsEnabled={animationsEnabled}
                rebound={reboundMap[tracker.id]}
              >
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
                  />
                </View>
                {/* Gap collapses with the row so spacing doesn't persist after exit */}
                {index < visibleTrackers.length - 1 && <View style={styles.rowGap} />}
              </AnimatedExitRow>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}
