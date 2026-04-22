import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isCompleted } from '@/components/today-tracker-list-action';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { getRoutines, saveRoutines } from '@/lib/storage';
import { Entry, Routine, RoutineTracker, Tracker } from '@/lib/types';
import { getLogicalDay, trackerInterval } from '@/lib/utils';

interface RoutinesContextValue {
  isLoading: boolean;
  routines: Routine[];
  addRoutine: (data: Omit<Routine, 'id' | 'createdAt'>) => Promise<void>;
  updateRoutine: (id: string, changes: Partial<Omit<Routine, 'id' | 'createdAt'>>) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  /** True when all trackers in the routine satisfy their completion criteria for today */
  isRoutineCompleted: (routine: Routine) => boolean;
  /** Bulk-completes all non-done trackers in the routine */
  markAllDone: (routine: Routine) => Promise<void>;
  /** The current-period entry map computed from today's logical day */
  currentPeriodEntryMap: Record<string, Entry>;
}

const RoutinesContext = createContext<RoutinesContextValue | null>(null);

export function RoutinesProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const { trackers, entries, addEntry, updateEntry, completeEntry } = useTrackers();
  const { today } = useCurrentDay();

  useEffect(() => {
    getRoutines().then((loaded) => {
      setRoutines(loaded);
      setIsLoading(false);
    });
  }, []);

  // Mirrors the currentPeriodEntryMap logic from today.tsx so RoutinesContext
  // can check completion without depending on the Today screen's local state.
  const todayMidnight = useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  const entriesByTracker = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      if (!map[e.trackerId]) map[e.trackerId] = [];
      map[e.trackerId].push(e);
    }
    return map;
  }, [entries]);

  const currentPeriodEntryMap = useMemo(() => {
    const map: Record<string, Entry> = {};
    for (const tracker of trackers) {
      const interval = trackerInterval(tracker);
      const cutoff = new Date(todayMidnight);
      cutoff.setDate(cutoff.getDate() - interval + 1);
      const trackerEntries = entriesByTracker[tracker.id] ?? [];
      const periodEntry = trackerEntries
        .filter((e) => {
          const day = getLogicalDay(new Date(e.createdAt), e.dayStartHour ?? 0);
          day.setHours(0, 0, 0, 0);
          return day >= cutoff;
        })
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0];
      if (periodEntry) map[tracker.id] = periodEntry;
    }
    return map;
  }, [trackers, entriesByTracker, todayMidnight]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addRoutine = useCallback(async (data: Omit<Routine, 'id' | 'createdAt'>) => {
    const routine: Routine = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
    const updated = [...routines, routine];
    setRoutines(updated);
    await saveRoutines(updated);
  }, [routines]);

  const updateRoutine = useCallback(async (id: string, changes: Partial<Omit<Routine, 'id' | 'createdAt'>>) => {
    const updated = routines.map((r) => (r.id === id ? { ...r, ...changes } : r));
    setRoutines(updated);
    await saveRoutines(updated);
  }, [routines]);

  const deleteRoutine = useCallback(async (id: string) => {
    const updated = routines.filter((r) => r.id !== id);
    setRoutines(updated);
    await saveRoutines(updated);
  }, [routines]);

  // ── Completion helpers ────────────────────────────────────────────────────────

  const isRoutineCompleted = useCallback((routine: Routine): boolean => {
    return routine.trackers.every((rt) => {
      const tracker = trackers.find((t) => t.id === rt.id);
      // Stale ID (tracker deleted) — treat as done so it doesn't block the routine.
      if (!tracker) return true;
      return isRoutineTrackerCompleted(rt, tracker, currentPeriodEntryMap[rt.id]);
    });
  }, [trackers, currentPeriodEntryMap]);

  const markAllDone = useCallback(async (routine: Routine) => {
    for (const rt of routine.trackers) {
      const tracker = trackers.find((t) => t.id === rt.id);
      if (!tracker) continue;

      const existing = currentPeriodEntryMap[rt.id];
      if (isRoutineTrackerCompleted(rt, tracker, existing)) continue;

      // Sequential awaits are intentional: addEntry captures realEntries in a
      // closure, so parallel calls would each see stale state and clobber each other.
      if (tracker.type === 'log') {
        if (existing) {
          await completeEntry(existing.id);
        } else {
          await addEntry({ trackerId: rt.id, value: 0, completed: true });
        }
      } else {
        const targetValue = getMarkDoneValue(rt, tracker);
        if (existing) {
          await updateEntry(existing.id, targetValue);
        } else {
          await addEntry({ trackerId: rt.id, value: targetValue });
        }
      }
    }
  }, [trackers, currentPeriodEntryMap, addEntry, updateEntry, completeEntry]);

  return (
    <RoutinesContext.Provider value={{
      isLoading,
      routines,
      addRoutine, updateRoutine, deleteRoutine,
      isRoutineCompleted,
      markAllDone,
      currentPeriodEntryMap,
    }}>
      {children}
    </RoutinesContext.Provider>
  );
}

export function useRoutines(): RoutinesContextValue {
  const ctx = useContext(RoutinesContext);
  if (!ctx) throw new Error('useRoutines must be used within RoutinesProvider');
  return ctx;
}

/**
 * Checks whether a routine member is satisfied for the current period.
 * For count trackers, uses routineTarget instead of the tracker's own target
 * when a per-routine override is set.
 */
function isRoutineTrackerCompleted(rt: RoutineTracker, tracker: Tracker, entry: Entry | undefined): boolean {
  if (!entry) return false;
  if (tracker.type === 'log') return entry.completed === true;
  if (tracker.type === 'boolean') return tracker.orientation === 'neutral' ? true : Number(entry.value) === 1;
  if (tracker.type === 'count') {
    const target = rt.routineTarget ?? tracker.target ?? 1;
    return Number(entry.value) >= target;
  }
  // Range: any value completes
  return true;
}

/** Returns the value to write when bulk-completing a tracker via "Mark all done". */
function getMarkDoneValue(rt: RoutineTracker, tracker: Tracker): number {
  if (tracker.type === 'boolean') return 1;
  if (tracker.type === 'count') return rt.routineTarget ?? tracker.target ?? 1;
  // Range: middle of 1–5
  return 3;
}
