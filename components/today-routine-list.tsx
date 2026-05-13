// Renders the active routine cards for a given day and owns the save/complete
// entry handlers scoped to routines. Manages card-level exit animation when a routine is fully done.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedExitRow } from '@/components/animated-exit-row';
import { RoutineCard } from '@/components/routine-card';
import { Space } from '@/constants/tokens';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { toRoutineDayOfWeek } from '@/lib/dates';
import { isRoutineActive } from '@/lib/tracker-utils';
import { Tracker } from '@/lib/types';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';

// How long the "All done" state lingers before the card slides out
const ROUTINE_DONE_LINGER_MS = 800;

const styles = StyleSheet.create({
  container: { paddingTop: Space.xs },
});

type TodayRoutineListProps = {
  // The current logical day - used to compute day-of-week and nowMinutes.
  today: Date;
};

export function TodayRoutineList({ today }: TodayRoutineListProps) {
  const { trackers, addEntry, updateEntry, completeEntry, isLoading: trackersLoading } = useTrackers();
  const { routines, isRoutineCompleted, markAllDone, currentPeriodEntryMap, isLoading: routinesLoading } = useRoutines();
  // Wait for both contexts to hydrate before classifying routines as
  // "completed on arrival": otherwise a routine can be momentarily seen as
  // incomplete (entries not yet loaded), recorded in the seen set, and then
  // animate out once entries hydrate.
  const hydrated = !trackersLoading && !routinesLoading;
  const animationsEnabled = useAnimationsEnabled();

  // Day-of-week in Routine.days convention: 0 = Monday, 6 = Sunday.
  const todayDow = toRoutineDayOfWeek(today);

  // Only show routines scheduled for today.
  const activeRoutines = useMemo(
    () => routines.filter((r) => r.days.includes(todayDow)),
    [routines, todayDow],
  );

  const [exitingRoutineIds, setExitingRoutineIds] = useState<Set<string>>(new Set());
  const [hiddenRoutineIds, setHiddenRoutineIds] = useState<Set<string>>(new Set());
  const doneTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Tracks routines whose dismiss has already been scheduled, so rapid re-renders
  // (or onAllDone firing on mount for already-done routines) don't double-schedule.
  const handledRoutineIds = useRef<Set<string>>(new Set());
  // Routines we've observed as incomplete during the current day session. Only
  // these are eligible for the linger+exit animation; routines that are already
  // completed when we first see them are hidden immediately with no animation.
  const seenIncompleteRoutineIds = useRef<Set<string>>(new Set());

  // Reset card-level dismiss state on day change so completed routines reappear the next day
  const prevTodayDowRef = useRef(todayDow);
  useEffect(() => {
    if (todayDow !== prevTodayDowRef.current) {
      prevTodayDowRef.current = todayDow;
      doneTimers.current.forEach(clearTimeout);
      doneTimers.current.clear();
      handledRoutineIds.current.clear();
      seenIncompleteRoutineIds.current.clear();
      setExitingRoutineIds(new Set());
      setHiddenRoutineIds(new Set());
    }
  }, [todayDow]);

  // Record routines currently incomplete so subsequent completion triggers the animation;
  // routines completed before we ever saw them incomplete stay filtered out silently.
  // Gated on hydration to avoid mis-classifying routines while entries are still loading.
  if (hydrated) {
    for (const r of activeRoutines) {
      if (!seenIncompleteRoutineIds.current.has(r.id) && !isRoutineCompleted(r)) {
        seenIncompleteRoutineIds.current.add(r.id);
      }
    }
  }

  useEffect(() => {
    return () => { doneTimers.current.forEach(clearTimeout); };
  }, []);

  const visibleRoutines = useMemo(
    () => {
      // Render nothing until both contexts hydrate; prevents the "completed routine
      // flashes then animates out" bug when entries arrive after routines.
      if (!hydrated) return [];
      return activeRoutines.filter((r) => {
        if (hiddenRoutineIds.has(r.id)) return false;
        // Skip routines that were already completed before we saw them incomplete:
        // they shouldn't flash on screen and then animate out.
        if (!seenIncompleteRoutineIds.current.has(r.id) && isRoutineCompleted(r)) return false;
        return true;
      });
    },
    [hydrated, activeRoutines, hiddenRoutineIds, isRoutineCompleted],
  );

  // Prune stale routine IDs from the hidden set (e.g. routine deleted, or restored after import)
  useEffect(() => {
    const activeIds = new Set(activeRoutines.map((r) => r.id));
    setHiddenRoutineIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => activeIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // Mirror the prune for our refs so a deleted-then-recreated routine
    // doesn't carry stale "seen/handled" state.
    for (const id of [...seenIncompleteRoutineIds.current]) {
      if (!activeIds.has(id)) seenIncompleteRoutineIds.current.delete(id);
    }
    for (const id of [...handledRoutineIds.current]) {
      if (!activeIds.has(id)) handledRoutineIds.current.delete(id);
    }
  }, [activeRoutines]);

  // Minutes since midnight - compared against routine start/end to detect active window.
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  // Save a value for a routine tracker — accumulates log entries, replaces others.
  const handleSave = useCallback(async (tracker: Tracker, value: number) => {
    const existing = currentPeriodEntryMap[tracker.id];
    if (tracker.type === 'log') {
      const currentTotal = existing ? (existing.value as number) : 0;
      const newTotal = currentTotal + value;
      if (existing) {
        await updateEntry(existing.id, newTotal);
      } else {
        await addEntry({ trackerId: tracker.id, value: newTotal });
      }
      return;
    }
    if (existing) {
      await updateEntry(existing.id, value);
    } else {
      await addEntry({ trackerId: tracker.id, value });
    }
  }, [currentPeriodEntryMap, updateEntry, addEntry]);

  // Mark a routine tracker as completed (creates or completes the entry).
  const handleComplete = useCallback(async (tracker: Tracker) => {
    const existing = currentPeriodEntryMap[tracker.id];
    if (existing) {
      await completeEntry(existing.id);
    } else {
      await addEntry({ trackerId: tracker.id, value: 0, completed: true });
    }
  }, [currentPeriodEntryMap, completeEntry, addEntry]);

  const handleRoutineAllDone = useCallback((routineId: string) => {
    if (handledRoutineIds.current.has(routineId)) return;
    handledRoutineIds.current.add(routineId);
    const timer = setTimeout(() => {
      doneTimers.current.delete(routineId);
      setExitingRoutineIds((prev) => new Set([...prev, routineId]));
    }, ROUTINE_DONE_LINGER_MS);
    doneTimers.current.set(routineId, timer);
  }, []);

  const handleRoutineExited = useCallback((routineId: string) => {
    handledRoutineIds.current.delete(routineId);
    setExitingRoutineIds((prev) => { const n = new Set(prev); n.delete(routineId); return n; });
    setHiddenRoutineIds((prev) => new Set([...prev, routineId]));
  }, []);

  if (activeRoutines.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleRoutines.map((routine) => {
        // Resolve tracker objects in the order the routine defines them.
        const routineTrackers = routine.trackers
          .map((rt) => trackers.find((t) => t.id === rt.id))
          .filter((t): t is Tracker => !!t);

        return (
          <AnimatedExitRow
            key={routine.id}
            exiting={exitingRoutineIds.has(routine.id)}
            onExited={() => handleRoutineExited(routine.id)}
            animationsEnabled={animationsEnabled}
          >
            <RoutineCard
              routine={routine}
              trackers={routineTrackers}
              entryMap={currentPeriodEntryMap}
              isActive={isRoutineActive(routine, nowMinutes)}
              isDone={isRoutineCompleted(routine)}
              onMarkAllDone={() => markAllDone(routine)}
              onSave={handleSave}
              onComplete={handleComplete}
              onAllDone={handleRoutineAllDone}
            />
          </AnimatedExitRow>
        );
      })}
    </View>
  );
}
