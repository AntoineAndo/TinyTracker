import { randomUUID } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useSettings } from '@/context/settings-context';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { getRoutineProgress, getRoutines, saveRoutineProgress, saveRoutines } from '@/lib/storage';
import { isRoutineTrackerCompleted } from '@/lib/tracker-utils';
import { Entry, Routine, RoutineProgress } from '@/lib/types';
import { getLogicalDay, toNumericValue, trackerInterval } from '@/lib/utils';

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
  /** Undoes the routine's effect for the current period: subtracts the routine's recorded
   *  contribution from count trackers (deleting the entry if it drops to zero), removes the
   *  routine's progress records, and clears the current entries for boolean/range/log
   *  trackers belonging to this routine. */
  resetRoutine: (routine: Routine) => Promise<void>;
  /** The current-period entry map computed from today's logical day */
  currentPeriodEntryMap: Record<string, Entry>;
  /** Recorded contributions of each routine to count trackers in the current period.
   *  Keyed as [routineId][trackerId] = amount. Used for routine-completion checks. */
  currentPeriodProgressMap: Record<string, Record<string, number>>;
  /** Attributes a delta increase of a count tracker to a routine. No-op when delta <= 0. */
  recordRoutineContribution: (routineId: string, trackerId: string, delta: number) => Promise<void>;
}

const RoutinesContext = createContext<RoutinesContextValue | null>(null);

export function RoutinesProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [progressRecords, setProgressRecords] = useState<RoutineProgress[]>([]);
  const { trackers, entries, addEntry, updateEntry, completeEntry, deleteEntry } = useTrackers();
  const { today } = useCurrentDay();
  const { dayStartHour } = useSettings();
  // Ref mirror of progressRecords so back-to-back recordRoutineContribution calls
  // (e.g. inside the markAllDone loop) read the latest state rather than the stale
  // closure snapshot.
  const progressRef = useRef<RoutineProgress[]>([]);

  useEffect(() => {
    Promise.all([getRoutines(), getRoutineProgress()]).then(([loadedRoutines, loadedProgress]) => {
      setRoutines(loadedRoutines);
      setProgressRecords(loadedProgress);
      progressRef.current = loadedProgress;
      setIsLoading(false);
    });
  }, []);

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

  // Aggregates recorded routine contributions into [routineId][trackerId] = amount for the
  // current period. Uses the same period bucketing as currentPeriodEntryMap so a stale
  // record from yesterday cannot count toward today's routine completion.
  const currentPeriodProgressMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const trackerById = new Map(trackers.map((t) => [t.id, t]));
    for (const record of progressRecords) {
      const tracker = trackerById.get(record.trackerId);
      if (!tracker) continue;
      const interval = trackerInterval(tracker);
      const cutoff = new Date(todayMidnight);
      cutoff.setDate(cutoff.getDate() - interval + 1);
      const day = getLogicalDay(new Date(record.createdAt), record.dayStartHour ?? 0);
      day.setHours(0, 0, 0, 0);
      if (day < cutoff) continue;
      if (!map[record.routineId]) map[record.routineId] = {};
      map[record.routineId][record.trackerId] = (map[record.routineId][record.trackerId] ?? 0) + record.amount;
    }
    return map;
  }, [progressRecords, trackers, todayMidnight]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addRoutine = useCallback(async (data: Omit<Routine, 'id' | 'createdAt'>) => {
    const routine: Routine = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
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

  // ── Progress recording ────────────────────────────────────────────────────────
  // Upserts a routine's contribution to a count tracker for the current period. If a
  // record already exists in the current period it is incremented in place so we keep
  // one row per (routine, tracker, period); otherwise a fresh record is appended.

  const recordRoutineContribution = useCallback(async (routineId: string, trackerId: string, delta: number) => {
    if (delta <= 0) return;
    const tracker = trackers.find((t) => t.id === trackerId);
    if (!tracker) return;

    const interval = trackerInterval(tracker);
    const cutoff = new Date(todayMidnight);
    cutoff.setDate(cutoff.getDate() - interval + 1);

    const records = progressRef.current;
    const currentIdx = records.findIndex((r) => {
      if (r.routineId !== routineId || r.trackerId !== trackerId) return false;
      const day = getLogicalDay(new Date(r.createdAt), r.dayStartHour ?? 0);
      day.setHours(0, 0, 0, 0);
      return day >= cutoff;
    });

    let updated: RoutineProgress[];
    if (currentIdx >= 0) {
      // Preserve the original createdAt so the record's period bucket can't drift across
      // the day boundary when contributions are added near the cutoff. Only amount grows.
      updated = records.map((r, i) => (i === currentIdx
        ? { ...r, amount: r.amount + delta }
        : r));
    } else {
      updated = [...records, {
        id: randomUUID(),
        routineId,
        trackerId,
        amount: delta,
        createdAt: new Date().toISOString(),
        dayStartHour,
      }];
    }
    progressRef.current = updated;
    setProgressRecords(updated);
    await saveRoutineProgress(updated);
  }, [trackers, todayMidnight, dayStartHour]);

  // ── Completion helpers ────────────────────────────────────────────────────────

  const isRoutineCompleted = useCallback((routine: Routine): boolean => {
    return routine.trackers.every((rt) => {
      const tracker = trackers.find((t) => t.id === rt.id);
      // Stale ID (tracker deleted) — treat as done so it doesn't block the routine.
      if (!tracker) return true;
      const progress = currentPeriodProgressMap[routine.id]?.[rt.id] ?? 0;
      return isRoutineTrackerCompleted(tracker, currentPeriodEntryMap[rt.id], rt.routineTarget, progress);
    });
  }, [trackers, currentPeriodEntryMap, currentPeriodProgressMap]);

  const markAllDone = useCallback(async (routine: Routine) => {
    for (const rt of routine.trackers) {
      const tracker = trackers.find((t) => t.id === rt.id);
      if (!tracker) continue;

      const existing = currentPeriodEntryMap[rt.id];
      const progress = currentPeriodProgressMap[routine.id]?.[rt.id] ?? 0;
      if (isRoutineTrackerCompleted(tracker, existing, rt.routineTarget, progress)) continue;

      if (tracker.type === 'log') {
        if (existing) {
          await completeEntry(existing.id);
        } else {
          await addEntry({ trackerId: rt.id, value: 0, completed: true });
        }
      } else if (tracker.type === 'count') {
        // Relative target: add the routine's contribution to the current value, capped at
        // the tracker's own target. Record the actual delta written so the routine's
        // completion check reflects what this routine added.
        const currentVal = existing ? toNumericValue(existing.value) : 0;
        const requested = rt.routineTarget ?? tracker.target ?? 1;
        const cap = tracker.target ?? Number.POSITIVE_INFINITY;
        const newVal = Math.min(currentVal + requested, cap);
        const delta = newVal - currentVal;
        if (delta > 0) {
          if (existing) {
            await updateEntry(existing.id, newVal);
          } else {
            await addEntry({ trackerId: rt.id, value: newVal });
          }
        }
        await recordRoutineContribution(routine.id, rt.id, delta);
      } else {
        // boolean → 1; range → middle of 1–5.
        const targetValue = tracker.type === 'boolean' ? 1 : 3;
        if (existing) {
          await updateEntry(existing.id, targetValue);
        } else {
          await addEntry({ trackerId: rt.id, value: targetValue });
        }
      }
    }
  }, [trackers, currentPeriodEntryMap, currentPeriodProgressMap, addEntry, updateEntry, completeEntry, recordRoutineContribution]);

  // Undoes the effect of the routine for the current period. Count trackers are
  // decremented by exactly the routine's recorded contribution so a tracker shared with
  // other routines keeps the other routines' progress intact. Non-count trackers have
  // no per-routine attribution so we conservatively clear the current-period entry,
  // which matches the user expectation of "this routine didn't happen".
  const resetRoutine = useCallback(async (routine: Routine) => {
    for (const rt of routine.trackers) {
      const tracker = trackers.find((t) => t.id === rt.id);
      if (!tracker) continue;
      const existing = currentPeriodEntryMap[rt.id];
      if (tracker.type === 'count') {
        const contributed = currentPeriodProgressMap[routine.id]?.[rt.id] ?? 0;
        if (existing && contributed > 0) {
          const currentVal = toNumericValue(existing.value);
          const newVal = Math.max(0, currentVal - contributed);
          if (newVal === 0) {
            await deleteEntry(existing.id);
          } else {
            await updateEntry(existing.id, newVal);
          }
        }
      } else if (existing) {
        await deleteEntry(existing.id);
      }
    }
    // Drop all progress records for this routine in the current period so the routine
    // reverts to its incomplete state and can be redone.
    const trackerById = new Map(trackers.map((t) => [t.id, t]));
    const remaining = progressRef.current.filter((r) => {
      if (r.routineId !== routine.id) return true;
      const tracker = trackerById.get(r.trackerId);
      if (!tracker) return true;
      const interval = trackerInterval(tracker);
      const cutoff = new Date(todayMidnight);
      cutoff.setDate(cutoff.getDate() - interval + 1);
      const day = getLogicalDay(new Date(r.createdAt), r.dayStartHour ?? 0);
      day.setHours(0, 0, 0, 0);
      return day < cutoff;
    });
    if (remaining.length !== progressRef.current.length) {
      progressRef.current = remaining;
      setProgressRecords(remaining);
      await saveRoutineProgress(remaining);
    }
  }, [trackers, currentPeriodEntryMap, currentPeriodProgressMap, todayMidnight, deleteEntry, updateEntry]);

  return (
    <RoutinesContext.Provider value={{
      isLoading,
      routines,
      addRoutine, updateRoutine, deleteRoutine,
      isRoutineCompleted,
      markAllDone,
      resetRoutine,
      currentPeriodEntryMap,
      currentPeriodProgressMap,
      recordRoutineContribution,
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
