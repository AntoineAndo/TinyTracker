// Renders the active routine cards for a given day and owns the save/complete entry
// handlers scoped to routines. Completed routine cards stay visible all day in their
// "All done ✓" state instead of animating out.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { RoutineCard } from '@/components/routine-card';
import { Space } from '@/constants/tokens';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { toRoutineDayOfWeek } from '@/lib/dates';
import { isRoutineActive } from '@/lib/tracker-utils';
import { Tracker } from '@/lib/types';
import { toNumericValue } from '@/lib/utils';

const styles = StyleSheet.create({
  container: { paddingTop: Space.xs },
});

type TodayRoutineListProps = {
  // The current logical day - used to compute day-of-week and nowMinutes.
  today: Date;
  // Which subset to render. Defaults to 'pending' so the unmodified call site keeps
  // showing only routines that still need work; pass 'completed' to render the
  // finished ones inside the Today screen's "Completed" section.
  filter?: 'pending' | 'completed';
};

export function TodayRoutineList({ today, filter = 'pending' }: TodayRoutineListProps) {
  const { trackers, addEntry, updateEntry, completeEntry, isLoading: trackersLoading } = useTrackers();
  const { routines, isRoutineCompleted, markAllDone, resetRoutine, currentPeriodEntryMap, currentPeriodProgressMap, recordRoutineContribution, isLoading: routinesLoading } = useRoutines();
  // Wait for both contexts to hydrate before rendering so a completed routine
  // doesn't flash as incomplete while entries are still loading.
  const hydrated = !trackersLoading && !routinesLoading;

  // Day-of-week in Routine.days convention: 0 = Monday, 6 = Sunday.
  const todayDow = toRoutineDayOfWeek(today);

  // Only show routines scheduled for today.
  const activeRoutines = useMemo(
    () => routines.filter((r) => r.days.includes(todayDow)),
    [routines, todayDow],
  );

  const visibleRoutines = useMemo(
    () => (hydrated ? activeRoutines.filter((r) => (filter === 'completed' ? isRoutineCompleted(r) : !isRoutineCompleted(r))) : []),
    [hydrated, activeRoutines, filter, isRoutineCompleted],
  );

  // Minutes since midnight, ticked once per minute so the active-window check stays
  // current without forcing the whole logical-day state to refresh. `today` from
  // useCurrentDay only updates on foreground/day rollover, so its hour/minute is
  // stale during long-running sessions and can't drive isRoutineActive on its own.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => { clearInterval(id); sub.remove(); };
  }, []);

  // Save a value for a routine tracker — accumulates log entries, replaces others.
  // For count trackers we also attribute the positive delta to the routine so the routine's
  // completion state reflects the manual +1 clicks made from inside this card.
  const handleSave = useCallback(async (tracker: Tracker, value: number, routineId: string) => {
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
    if (tracker.type === 'count') {
      const previous = existing ? toNumericValue(existing.value) : 0;
      const delta = value - previous;
      if (delta > 0) await recordRoutineContribution(routineId, tracker.id, delta);
    }
  }, [currentPeriodEntryMap, updateEntry, addEntry, recordRoutineContribution]);

  // Mark a routine tracker as completed (creates or completes the entry).
  const handleComplete = useCallback(async (tracker: Tracker) => {
    const existing = currentPeriodEntryMap[tracker.id];
    if (existing) {
      await completeEntry(existing.id);
    } else {
      await addEntry({ trackerId: tracker.id, value: 0, completed: true });
    }
  }, [currentPeriodEntryMap, completeEntry, addEntry]);

  if (visibleRoutines.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleRoutines.map((routine) => {
        // Resolve tracker objects in the order the routine defines them.
        const routineTrackers = routine.trackers
          .map((rt) => trackers.find((t) => t.id === rt.id))
          .filter((t): t is Tracker => !!t);

        // Show the reset button when something in the routine has actually been touched
        // today: either recorded routine progress, or a non-count tracker with a current
        // entry that the reset would clear.
        const routineProgress = currentPeriodProgressMap[routine.id] ?? {};
        const hasProgress = routineTrackers.some((t) => {
          if (t.type === 'count') return (routineProgress[t.id] ?? 0) > 0;
          return !!currentPeriodEntryMap[t.id];
        });

        return (
          <RoutineCard
            key={routine.id}
            routine={routine}
            trackers={routineTrackers}
            entryMap={currentPeriodEntryMap}
            progressMap={routineProgress}
            isActive={isRoutineActive(routine, nowMinutes)}
            isDone={isRoutineCompleted(routine)}
            hasProgress={hasProgress}
            onMarkAllDone={() => markAllDone(routine)}
            onReset={() => resetRoutine(routine)}
            onSave={(tracker, value) => handleSave(tracker, value, routine.id)}
            onComplete={handleComplete}
          />
        );
      })}
    </View>
  );
}
