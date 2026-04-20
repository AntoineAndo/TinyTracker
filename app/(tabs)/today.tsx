import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { EditEntryDrawer } from '@/components/edit-entry-drawer';
import { isCompleted, TodayTrackerList, wouldComplete } from '@/components/today-tracker-list';
import { useSettings } from '@/context/settings-context';
import { useTrackers } from '@/context/trackers-context';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { useCurrentDay } from '@/hooks/use-current-day';
import { Entry, Tracker } from '@/lib/types';
import { getLogicalDay, getStreak, nextDueDate, trackerInterval } from '@/lib/utils';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    topSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 50,
    },
    bottomSection: {
      flex: 2,
      backgroundColor: c.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    bottomHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { fontSize: 22, fontWeight: '700', color: c.text },
    toggle: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1.5, borderColor: c.border,
    },
    toggleActive: { backgroundColor: c.toggleActiveBg, borderColor: c.toggleActiveBg },
    toggleText: { fontSize: 14, fontWeight: '600', color: c.textSub },
    toggleTextActive: { color: c.toggleActiveText },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text },
    allDoneText: { fontSize: 22, fontWeight: '700', color: '#22c55e' },
    emptySubtext: { fontSize: 15, color: c.textSub, textAlign: 'center' },
    sectionLabel: {
      fontSize: 13, fontWeight: '700', color: c.textSub,
      textTransform: 'uppercase', letterSpacing: 0.5,
      paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4,
    },
  });
}

function dueLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export default function TodayScreen() {
  const { isLoading, trackers, entries, addEntry, updateEntry, completeEntry, deleteEntry } = useTrackers();
  const { characterConfig } = useSettings();
  const [showAll, setShowAll] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [pendingDismissIds, setPendingDismissIds] = useState<Set<string>>(new Set());
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { today } = useCurrentDay();

  const todayMidnight = useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  const yesterday = useMemo(() => {
    const d = new Date(todayMidnight);
    d.setDate(d.getDate() - 1);
    return d;
  }, [todayMidnight]);

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

  const streakMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tracker of trackers) {
      if (tracker.reminderFrequency !== 'daily') continue;
      if (tracker.type !== 'boolean' && tracker.type !== 'count') continue;
      // orientation defaults to 'goal' when absent (existing trackers without the field)
      if (tracker.orientation === 'neutral') continue;
      const trackerEntries = entriesByTracker[tracker.id] ?? [];
      const alreadyDone = isCompleted(tracker, currentPeriodEntryMap[tracker.id]);
      map[tracker.id] = getStreak(tracker, trackerEntries, alreadyDone ? today : yesterday);
    }
    return map;
  }, [trackers, entriesByTracker, currentPeriodEntryMap, today, yesterday]);

  const groups = useMemo(() => {
    const map: Record<number, Tracker[]> = {};
    for (const tracker of trackers) {
      const trackerEntries = entriesByTracker[tracker.id] ?? [];
      const due = nextDueDate(tracker, trackerEntries, todayMidnight);
      const diffMs = due.getTime() - todayMidnight.getTime();
      // Daily trackers (interval === 1) are pinned to "Today" even after completion.
      // Without this, nextDueDate() returns tomorrow once the tracker is logged, which
      // moves it to the "Tomorrow" section mid-day. Since daily trackers repeat every
      // single day they are always relevant today — hiding them in "Tomorrow" after
      // logging is confusing and makes the list feel empty too early.
      const daysUntil = trackerInterval(tracker) === 1
        ? 0
        : Math.max(0, Math.round(diffMs / 86400000));
      if (!map[daysUntil]) map[daysUntil] = [];
      map[daysUntil].push(tracker);
    }
    return map;
  }, [trackers, entriesByTracker, todayMidnight]);

  const sortedDays = useMemo(() => Object.keys(groups).map(Number).sort((a, b) => a - b), [groups]);

  const allPending = trackers.filter((t) => !isCompleted(t, currentPeriodEntryMap[t.id]));
  const allDone = trackers.length > 0 && allPending.length === 0;

  // Trackers completed within the current period — shown in a dedicated section at
  // the bottom when "Show completed" is toggled on, instead of inside their date groups.
  const completedTrackers = useMemo(
    () => trackers.filter((t) => isCompleted(t, currentPeriodEntryMap[t.id])),
    [trackers, currentPeriodEntryMap],
  );

  async function handleSave(tracker: Tracker, value: number) {
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

    const alreadyDone = isCompleted(tracker, existing);
    if (!alreadyDone && wouldComplete(tracker, value) && !showAll) {
      const delay = (tracker.type === 'boolean' || tracker.type === 'count') && tracker.reminderFrequency === 'daily' ? 750 : 0;
      setPendingDismissIds((prev) => new Set([...prev, tracker.id]));
      setTimeout(() => {
        setPendingDismissIds((prev) => { const n = new Set(prev); n.delete(tracker.id); return n; });
        setExitingIds((prev) => new Set([...prev, tracker.id]));
      }, delay);
    }
    if (existing) {
      await updateEntry(existing.id, value);
    } else {
      await addEntry({ trackerId: tracker.id, value });
    }
  }

  async function handleComplete(tracker: Tracker) {
    const existing = currentPeriodEntryMap[tracker.id];
    if (!showAll) {
      const delay = (tracker.type === 'boolean' || tracker.type === 'count') && tracker.reminderFrequency === 'daily' ? 750 : 0;
      setPendingDismissIds((prev) => new Set([...prev, tracker.id]));
      setTimeout(() => {
        setPendingDismissIds((prev) => { const n = new Set(prev); n.delete(tracker.id); return n; });
        setExitingIds((prev) => new Set([...prev, tracker.id]));
      }, delay);
    }
    if (existing) {
      await completeEntry(existing.id);
    } else {
      await addEntry({ trackerId: tracker.id, value: 0, completed: true });
    }
  }

  return (
    <View style={styles.container}>
      {/* Top section — character */}
      <View style={styles.topSection}>
        <CharacterAvatar config={characterConfig} size={250} interactive />
      </View>

      {/* Bottom section — tracker list */}
      <View style={styles.bottomSection}>
        <View style={styles.bottomHeader}>
          <Text style={styles.title}>Today</Text>
          {trackers.length > 0 && (
            <Pressable
              style={[styles.toggle, showAll && styles.toggleActive]}
              onPress={() => setShowAll((v) => !v)}>
              <Text style={[styles.toggleText, showAll && styles.toggleTextActive]}>Show completed</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={c.textSub} />
          </View>
        ) : trackers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trackers yet.</Text>
            <Text style={styles.emptySubtext}>Create a tracker to get started.</Text>
          </View>
        ) : allDone && !showAll ? (
          <View style={styles.empty}>
            <Text style={styles.allDoneText}>All done for today!</Text>
            <Text style={styles.emptySubtext}>Tap &quot;Show completed&quot; to review your entries.</Text>
          </View>
        ) : (
          <ScrollView>
            {sortedDays.map((daysUntil) => {
              const sectionTrackers = groups[daysUntil] ?? [];

              // Completed non-daily trackers that are in the second half of their
              // period (daysUntil < interval/2) should remain visible in their date
              // section so the user can see the next due date is approaching, even
              // though they already logged this period.
              const forcedCompletedIds = new Set(
                sectionTrackers
                  .filter((t) => {
                    const interval = trackerInterval(t);
                    return (
                      interval > 1 &&
                      isCompleted(t, currentPeriodEntryMap[t.id]) &&
                      daysUntil < interval / 2
                    );
                  })
                  .map((t) => t.id),
              );

              // Skip sections with nothing to show — completed daily trackers move
              // to the "Completed" section; completed non-daily ones only stay when
              // they're within the second half of their period (forcedCompletedIds).
              const hasVisible = sectionTrackers.some(
                (t) =>
                  !isCompleted(t, currentPeriodEntryMap[t.id]) ||
                  exitingIds.has(t.id) ||
                  pendingDismissIds.has(t.id) ||
                  forcedCompletedIds.has(t.id),
              );
              if (!hasVisible) return null;

              return (
                <View key={daysUntil}>
                  <Text style={styles.sectionLabel}>{dueLabel(daysUntil)}</Text>
                  <TodayTrackerList
                    trackers={sectionTrackers}
                    entryMap={currentPeriodEntryMap}
                    streakMap={streakMap}
                    showCompleted={false}
                    forcedCompletedIds={forcedCompletedIds}
                    exitingIds={exitingIds}
                    pendingDismissIds={pendingDismissIds}
                    onSave={handleSave}
                    onComplete={handleComplete}
                    onEdit={(tracker, entry) => { setEditingTracker(tracker); setEditingEntry(entry); }}
                    onExited={(id) => setExitingIds((prev) => {
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    })}
                  />
                </View>
              );
            })}

            {/* Completed section — only visible when "Show completed" is toggled on */}
            {showAll && completedTrackers.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>Completed</Text>
                <TodayTrackerList
                  trackers={completedTrackers}
                  entryMap={currentPeriodEntryMap}
                  streakMap={streakMap}
                  showCompleted={true}
                  exitingIds={new Set()}
                  pendingDismissIds={new Set()}
                  onSave={handleSave}
                  onComplete={handleComplete}
                  onEdit={(tracker, entry) => { setEditingTracker(tracker); setEditingEntry(entry); }}
                  onExited={() => {}}
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {editingTracker && editingEntry && (
        <EditEntryDrawer
          tracker={editingTracker}
          entry={editingEntry}
          onSave={async (value) => {
            await updateEntry(editingEntry.id, value);
            setEditingTracker(null);
            setEditingEntry(null);
          }}
          onDelete={async () => {
            await deleteEntry(editingEntry.id);
            setEditingTracker(null);
            setEditingEntry(null);
          }}
          onClose={() => { setEditingTracker(null); setEditingEntry(null); }}
        />
      )}
    </View>
  );
}
