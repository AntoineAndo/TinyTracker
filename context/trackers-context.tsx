// Trackers + entries context. Owns the in-memory state, the chunked-storage
// reads/writes, and the derived per-tracker/per-day pivot used by the graph
// and correlation features. The pivot lives here as a single source of truth
// so consumers do not recompute it (project rule, see CLAUDE.md).
import { randomUUID } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useSettings } from '@/context/settings-context';
import { MOCK_ENTRIES, MOCK_TRACKERS } from '@/lib/mock-data';
import {
  getChunk,
  getIndex,
  getTrackers,
  loadChunk,
  loadInitialEntries,
  migrateIfNeeded,
  saveChunk,
  saveIndex,
  saveLoadedEntries,
  saveTrackers,
  sealAndCreateChunk,
} from '@/lib/storage';
import { ChunkIndex, Entry, Tracker } from '@/lib/types';
import { fromDateString, getCurrentDay, getLogicalDay, toDateString } from '@/lib/utils';

const CHUNK_DAYS = 90;

interface TrackersContextValue {
  isLoading: boolean;
  trackers: Tracker[];
  entries: Entry[];
  /** Pivot keyed by trackerId then YYYY-MM-DD logical day. Most recent entry wins per cell. */
  entriesByTrackerByDay: Record<string, Record<string, Entry>>;
  /** YYYY-MM-DD of the oldest currently-loaded entry; null when no entries exist. */
  oldestLoadedDay: string | null;
  hasMoreEntries: boolean;
  loadMoreEntries: () => Promise<void>;
  mockMode: boolean;
  setMockMode: (v: boolean) => void;
  addTracker: (tracker: Omit<Tracker, 'id' | 'createdAt'>) => Promise<void>;
  updateTracker: (id: string, changes: Partial<Omit<Tracker, 'id' | 'createdAt'>>) => Promise<void>;
  deleteTracker: (id: string) => Promise<void>;
  addEntry: (entry: Omit<Entry, 'id' | 'createdAt' | 'dayStartHour'>) => Promise<void>;
  addEntryForDate: (entry: Omit<Entry, 'id' | 'createdAt' | 'dayStartHour'>, date: Date) => Promise<void>;
  updateEntry: (id: string, value: boolean | number) => Promise<void>;
  completeEntry: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

const TrackersContext = createContext<TrackersContextValue | null>(null);

export function TrackersProvider({ children }: { children: React.ReactNode }) {
  const { dayStartHour } = useSettings();

  const [isLoading, setIsLoading] = useState(true);
  const [realTrackers, setRealTrackers] = useState<Tracker[]>([]);
  const [realEntries, setRealEntries] = useState<Entry[]>([]);
  // Ref that always holds the latest realEntries so mutation callbacks that are
  // called in sequence (e.g. markAllDone loop) see up-to-date state without
  // needing to be recreated after each state update.
  const realEntriesRef = useRef<Entry[]>([]);
  realEntriesRef.current = realEntries;
  const [chunkIndex, setChunkIndex] = useState<ChunkIndex>([]);
  const [loadedChunkCount, setLoadedChunkCount] = useState(1);
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    async function load() {
      await migrateIfNeeded(dayStartHour);
      const [trackers, { index, entries, initialChunkCount }] = await Promise.all([
        getTrackers(),
        loadInitialEntries(dayStartHour),
      ]);
      setRealTrackers(trackers);
      setChunkIndex(index);
      setRealEntries(entries);
      setLoadedChunkCount(initialChunkCount);
      setIsLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const trackers = mockMode ? MOCK_TRACKERS : realTrackers;
  const entries = mockMode ? MOCK_ENTRIES : realEntries;
  const hasMoreEntries = !mockMode && loadedChunkCount < chunkIndex.length;

  // Lifted pivot: trackerId -> YYYY-MM-DD -> Entry (most recent wins per cell).
  // The graph used to recompute this locally; correlations need it too. Done
  // in a single pass so we also derive `oldestLoadedDay` for free.
  const { entriesByTrackerByDay, oldestLoadedDay } = useMemo(() => {
    const map: Record<string, Record<string, Entry>> = {};
    let oldest: string | null = null;
    for (const entry of entries) {
      if (!map[entry.trackerId]) map[entry.trackerId] = {};
      const day = getLogicalDay(new Date(entry.createdAt), entry.dayStartHour ?? 0);
      const dayStr = toDateString(day);
      const existing = map[entry.trackerId][dayStr];
      if (!existing || entry.createdAt > existing.createdAt) {
        map[entry.trackerId][dayStr] = entry;
      }
      if (oldest === null || dayStr < oldest) oldest = dayStr;
    }
    return { entriesByTrackerByDay: map, oldestLoadedDay: oldest };
  }, [entries]);

  // ── Tracker mutations ───────────────────────────────────────────────────────

  const addTracker = useCallback(async (data: Omit<Tracker, 'id' | 'createdAt'>) => {
    const tracker: Tracker = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    const updated = [...realTrackers, tracker];
    setRealTrackers(updated);
    await saveTrackers(updated);
  }, [realTrackers]);

  const updateTracker = useCallback(async (id: string, changes: Partial<Omit<Tracker, 'id' | 'createdAt'>>) => {
    const updated = realTrackers.map((t) => (t.id === id ? { ...t, ...changes } : t));
    setRealTrackers(updated);
    await saveTrackers(updated);
  }, [realTrackers]);

  const deleteTracker = useCallback(async (id: string) => {
    const updatedTrackers = realTrackers.filter((t) => t.id !== id);
    setRealTrackers(updatedTrackers);
    await saveTrackers(updatedTrackers);

    // Clean entries from ALL chunks, including unloaded ones
    const index = await getIndex();
    await Promise.all(
      index.map(async (meta) => {
        const chunkEntries = await getChunk(meta.id);
        const filtered = chunkEntries.filter((e) => e.trackerId !== id);
        if (filtered.length !== chunkEntries.length) {
          await saveChunk(meta.id, filtered);
        }
      })
    );

    setRealEntries((prev) => prev.filter((e) => e.trackerId !== id));
  }, [realTrackers]);

  // ── Entry mutations ─────────────────────────────────────────────────────────

  const addEntry = useCallback(async (data: Omit<Entry, 'id' | 'createdAt' | 'dayStartHour'>) => {
    const today = getCurrentDay(dayStartHour);
    let currentIndex = chunkIndex;

    // Check if rollover is needed
    if (currentIndex.length > 0) {
      const activeChunk = currentIndex[currentIndex.length - 1];
      const chunkFrom = fromDateString(activeChunk.from);
      const diffDays = Math.floor((today.getTime() - chunkFrom.getTime()) / 86400000);
      if (diffDays > CHUNK_DAYS) {
        const newIndex = sealAndCreateChunk(currentIndex, today);
        await saveIndex(newIndex);
        currentIndex = newIndex;
        setChunkIndex(newIndex);
      }
    }

    const entry: Entry = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      dayStartHour,
    };

    // Eagerly update the ref so back-to-back calls (e.g. markAllDone loop) see
    // the latest entries without waiting for a re-render to refresh the closure.
    const updated = [...realEntriesRef.current, entry];
    realEntriesRef.current = updated;
    setRealEntries(updated);
    await saveLoadedEntries(currentIndex, updated, dayStartHour);
  }, [chunkIndex, dayStartHour]);

  const addEntryForDate = useCallback(async (data: Omit<Entry, 'id' | 'createdAt' | 'dayStartHour'>, date: Date) => {
    const noon = new Date(date);
    noon.setHours(12, 0, 0, 0);
    const entry: Entry = {
      ...data,
      id: randomUUID(),
      createdAt: noon.toISOString(),
      dayStartHour,
    };
    const updated = [...realEntriesRef.current, entry];
    realEntriesRef.current = updated;
    setRealEntries(updated);
    await saveLoadedEntries(chunkIndex, updated, dayStartHour);
  }, [chunkIndex, dayStartHour]);

  const updateEntry = useCallback(async (id: string, value: boolean | number) => {
    const updated = realEntriesRef.current.map((e) => e.id === id ? { ...e, value } : e);
    realEntriesRef.current = updated;
    setRealEntries(updated);
    await saveLoadedEntries(chunkIndex, updated, dayStartHour);
  }, [chunkIndex, dayStartHour]);

  const completeEntry = useCallback(async (id: string) => {
    const updated = realEntriesRef.current.map((e) => e.id === id ? { ...e, completed: true } : e);
    realEntriesRef.current = updated;
    setRealEntries(updated);
    await saveLoadedEntries(chunkIndex, updated, dayStartHour);
  }, [chunkIndex, dayStartHour]);

  const deleteEntry = useCallback(async (id: string) => {
    const updated = realEntriesRef.current.filter((e) => e.id !== id);
    realEntriesRef.current = updated;
    setRealEntries(updated);
    await saveLoadedEntries(chunkIndex, updated, dayStartHour);
  }, [chunkIndex, dayStartHour]);

  // ── Load more ───────────────────────────────────────────────────────────────

  const loadMoreEntries = useCallback(async () => {
    if (loadedChunkCount >= chunkIndex.length) return;
    const position = chunkIndex.length - loadedChunkCount - 1;
    const olderEntries = await loadChunk(chunkIndex, position);
    setRealEntries((prev) => [...olderEntries, ...prev]);
    setLoadedChunkCount((n) => n + 1);
  }, [chunkIndex, loadedChunkCount]);

  return (
    <TrackersContext.Provider value={{
      isLoading,
      trackers, entries,
      entriesByTrackerByDay, oldestLoadedDay,
      hasMoreEntries, loadMoreEntries,
      mockMode, setMockMode,
      addTracker, updateTracker, deleteTracker,
      addEntry, addEntryForDate, updateEntry, completeEntry, deleteEntry,
    }}>
      {children}
    </TrackersContext.Provider>
  );
}

export function useTrackers(): TrackersContextValue {
  const ctx = useContext(TrackersContext);
  if (!ctx) throw new Error('useTrackers must be used within TrackersProvider');
  return ctx;
}
