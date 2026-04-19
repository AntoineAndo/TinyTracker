import AsyncStorage from '@react-native-async-storage/async-storage';

import { ChunkIndex, ChunkMeta, Entry, Tracker } from './types';
import { fromDateString, getLogicalDay, getCurrentDay, toDateString } from './utils';

// ── Keys ──────────────────────────────────────────────────────────────────────

const TRACKERS_KEY = '@trackit/trackers';
const LEGACY_ENTRIES_KEY = '@trackit/entries';
const INDEX_KEY = '@trackit/entries/index';
const CHUNK_PREFIX = '@trackit/entries/';   // + chunk id, e.g. '@trackit/entries/chunk_1k3m2'

const CHUNK_DAYS = 90;

// ── Trackers ──────────────────────────────────────────────────────────────────

export async function getTrackers(): Promise<Tracker[]> {
  try {
    const raw = await AsyncStorage.getItem(TRACKERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTrackers(trackers: Tracker[]): Promise<void> {
  await AsyncStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
}

// ── Chunk index ───────────────────────────────────────────────────────────────

export async function getIndex(): Promise<ChunkIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveIndex(index: ChunkIndex): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ── Individual chunks ─────────────────────────────────────────────────────────

export async function getChunk(chunkId: string): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(CHUNK_PREFIX + chunkId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveChunk(chunkId: string, entries: Entry[]): Promise<void> {
  await AsyncStorage.setItem(CHUNK_PREFIX + chunkId, JSON.stringify(entries));
}

export async function deleteChunk(chunkId: string): Promise<void> {
  await AsyncStorage.removeItem(CHUNK_PREFIX + chunkId);
}

// ── Chunk ID generation ───────────────────────────────────────────────────────

function newChunkId(): string {
  return 'chunk_' + Date.now().toString(36);
}

// ── Rollover helpers ──────────────────────────────────────────────────────────

/** Returns true if the active chunk should be sealed (its `from` is >90 days ago). */
function needsRollover(activeChunk: ChunkMeta, today: Date): boolean {
  const chunkFrom = fromDateString(activeChunk.from);
  const diffDays = Math.floor((today.getTime() - chunkFrom.getTime()) / 86400000);
  return diffDays > CHUNK_DAYS;
}

/**
 * Seals the current active chunk and appends a new one.
 * Returns the updated index (does NOT save — caller must call saveIndex).
 */
export function sealAndCreateChunk(index: ChunkIndex, today: Date): ChunkIndex {
  const todayStr = toDateString(today);
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const updated = index.map((meta, i) =>
    i === index.length - 1 ? { ...meta, to: toDateString(yesterdayDate) } : meta
  );
  updated.push({ id: newChunkId(), from: todayStr, to: 'present' });
  return updated;
}

// ── High-level bootstrap ──────────────────────────────────────────────────────

/**
 * Loads the chunk index and the most-recent chunk's entries.
 * Creates an initial chunk if the index is empty.
 * Performs rollover if the active chunk is >90 days old.
 */
const GRAPH_DAYS = 30;

export async function loadInitialEntries(
  dayStartHour: number
): Promise<{ index: ChunkIndex; entries: Entry[]; initialChunkCount: number }> {
  let index = await getIndex();
  const today = getCurrentDay(dayStartHour);

  if (index.length === 0) {
    const initial: ChunkMeta = { id: newChunkId(), from: toDateString(today), to: 'present' };
    index = [initial];
    await saveIndex(index);
    return { index, entries: [], initialChunkCount: 1 };
  }

  const activeChunk = index[index.length - 1];

  if (needsRollover(activeChunk, today)) {
    const existingEntries = await getChunk(activeChunk.id);
    index = sealAndCreateChunk(index, today);
    await saveIndex(index);
    await saveChunk(index[index.length - 2].id, existingEntries);
    // Active chunk is empty — load previous chunk to cover the graph window
    if (index.length >= 2) {
      const prevEntries = await getChunk(index[index.length - 2].id);
      return { index, entries: prevEntries, initialChunkCount: 2 };
    }
    return { index, entries: [], initialChunkCount: 1 };
  }

  let entries = await getChunk(activeChunk.id);
  let initialChunkCount = 1;

  // If the active chunk started less than GRAPH_DAYS ago, also load the previous
  // chunk so the graph always has a full 30-day window to draw from.
  if (index.length >= 2) {
    const graphThreshold = new Date(today);
    graphThreshold.setDate(graphThreshold.getDate() - GRAPH_DAYS);
    if (fromDateString(activeChunk.from) > graphThreshold) {
      const prevEntries = await getChunk(index[index.length - 2].id);
      entries = [...prevEntries, ...entries];
      initialChunkCount = 2;
    }
  }

  return { index, entries, initialChunkCount };
}

/**
 * Loads the chunk at the given position in the index array (0 = oldest).
 */
export async function loadChunk(index: ChunkIndex, position: number): Promise<Entry[]> {
  const meta = index[position];
  if (!meta) return [];
  return getChunk(meta.id);
}

// ── Saving loaded entries back to chunks ──────────────────────────────────────

/**
 * Partitions all in-memory loaded entries back into their original chunks
 * (using the index's from/to ranges) and saves only the affected chunks.
 */
export async function saveLoadedEntries(
  index: ChunkIndex,
  entries: Entry[],
  dayStartHour: number
): Promise<void> {
  // Group entries by chunk id
  const groups: Record<string, Entry[]> = {};

  for (const entry of entries) {
    const logicalDay = getLogicalDay(new Date(entry.createdAt), entry.dayStartHour ?? dayStartHour);
    const logicalDayStr = toDateString(logicalDay);
    const chunkId = findChunkForDay(index, logicalDayStr);
    if (!groups[chunkId]) groups[chunkId] = [];
    groups[chunkId].push(entry);
  }

  await Promise.all(
    Object.entries(groups).map(([chunkId, chunkEntries]) => saveChunk(chunkId, chunkEntries))
  );
}

/** Returns the chunk ID whose [from, to] range contains the given logical day string. */
function findChunkForDay(index: ChunkIndex, logicalDayStr: string): string {
  for (let i = index.length - 1; i >= 0; i--) {
    const meta = index[i];
    if (logicalDayStr >= meta.from) {
      return meta.id;
    }
  }
  // Fallback: assign to the oldest chunk
  return index[0].id;
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * One-time migration from the legacy flat entries array to the chunked format.
 * No-op if migration has already run or if there is no legacy data.
 */
export async function migrateIfNeeded(dayStartHour: number): Promise<void> {
  const [legacyRaw, indexRaw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_ENTRIES_KEY),
    AsyncStorage.getItem(INDEX_KEY),
  ]);

  if (!legacyRaw || indexRaw) return; // Nothing to migrate, or already done

  let legacy: Entry[] = [];
  try {
    legacy = JSON.parse(legacyRaw);
  } catch {
    // Corrupted legacy data — skip migration, start fresh
    await AsyncStorage.removeItem(LEGACY_ENTRIES_KEY);
    return;
  }

  // Stamp dayStartHour on legacy entries (best-effort approximation)
  const stamped: Entry[] = legacy.map((e) => ({
    ...e,
    dayStartHour: e.dayStartHour ?? dayStartHour,
  }));

  // Sort ascending by createdAt
  stamped.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (stamped.length === 0) {
    await AsyncStorage.removeItem(LEGACY_ENTRIES_KEY);
    return;
  }

  // Group into 90-day chunks
  const chunks: { meta: ChunkMeta; entries: Entry[] }[] = [];
  let currentEntries: Entry[] = [];
  let chunkFromStr: string | null = null;

  for (const entry of stamped) {
    const logicalDay = getLogicalDay(new Date(entry.createdAt), entry.dayStartHour);
    const dayStr = toDateString(logicalDay);

    if (chunkFromStr === null) {
      chunkFromStr = dayStr;
    }

    const diffDays = Math.floor(
      (fromDateString(dayStr).getTime() - fromDateString(chunkFromStr).getTime()) / 86400000
    );

    if (diffDays > CHUNK_DAYS) {
      // Seal current chunk
      const lastEntry = currentEntries[currentEntries.length - 1];
      const lastDay = toDateString(getLogicalDay(new Date(lastEntry.createdAt), lastEntry.dayStartHour));
      chunks.push({ meta: { id: newChunkId(), from: chunkFromStr, to: lastDay }, entries: currentEntries });
      currentEntries = [];
      chunkFromStr = dayStr;
    }

    currentEntries.push(entry);
  }

  // Final (active) chunk
  chunks.push({ meta: { id: newChunkId(), from: chunkFromStr!, to: 'present' }, entries: currentEntries });

  // Save all chunks and build index
  const index: ChunkIndex = chunks.map((c) => c.meta);
  await Promise.all([
    saveIndex(index),
    ...chunks.map((c) => saveChunk(c.meta.id, c.entries)),
    AsyncStorage.removeItem(LEGACY_ENTRIES_KEY),
  ]);
}
