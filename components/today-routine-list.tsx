// Renders the active routine cards for a given day and owns the save/complete
// entry handlers scoped to routines (no dismiss animation, no streak logic).
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { RoutineCard } from '@/components/routine-card';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { toRoutineDayOfWeek } from '@/lib/dates';
import { isRoutineActive } from '@/lib/tracker-utils';
import { Tracker } from '@/lib/types';

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
});

type TodayRoutineListProps = {
  // The current logical day — used to compute day-of-week and nowMinutes.
  today: Date;
};

export function TodayRoutineList({ today }: TodayRoutineListProps) {
  const { trackers, addEntry, updateEntry, completeEntry } = useTrackers();
  const { routines, isRoutineCompleted, markAllDone, currentPeriodEntryMap } = useRoutines();

  // Day-of-week in Routine.days convention: 0 = Monday … 6 = Sunday.
  const todayDow = toRoutineDayOfWeek(today);

  // Only show routines scheduled for today.
  const activeRoutines = useMemo(
    () => routines.filter((r) => r.days.includes(todayDow)),
    [routines, todayDow],
  );

  // Minutes since midnight — compared against routine start/end to detect active window.
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

  if (activeRoutines.length === 0) return null;

  return (
    <View style={styles.container}>
      {activeRoutines.map((routine) => {
        // Resolve tracker objects in the order the routine defines them.
        const routineTrackers = routine.trackers
          .map((rt) => trackers.find((t) => t.id === rt.id))
          .filter((t): t is Tracker => !!t);

        return (
          <RoutineCard
            key={routine.id}
            routine={routine}
            trackers={routineTrackers}
            entryMap={currentPeriodEntryMap}
            isActive={isRoutineActive(routine, nowMinutes)}
            isDone={isRoutineCompleted(routine)}
            onMarkAllDone={() => markAllDone(routine)}
            onSave={handleSave}
            onComplete={handleComplete}
          />
        );
      })}
    </View>
  );
}
