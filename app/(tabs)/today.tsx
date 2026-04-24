// "Today" tab: the main daily action screen. Shows greeting + avatar, then a
// due-date-grouped list of trackers (Today/Tomorrow/…). Routine cards pin to
// the top of Today. Completion animates rows out; "Show completed" reveals them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Defs, Ellipse, RadialGradient, Stop, Svg } from 'react-native-svg';

import { CharacterAvatar } from '@/components/character-avatar';
import { EditEntryDrawer } from '@/components/edit-entry-drawer';
import { TAB_BAR_HEIGHT } from '@/components/custom-tab-bar';
import { isCompleted, TodayTrackerList, wouldComplete } from '@/components/today-tracker-list';
import { TodayRoutineList } from '@/components/today-routine-list';
import { Border, FontFamily, Motion, Radius, Space, Type, Weight } from '@/constants/tokens';
import { useRoutines } from '@/context/routines-context';
import { useSettings } from '@/context/settings-context';
import { useTrackers } from '@/context/trackers-context';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { useCurrentDay } from '@/hooks/use-current-day';
import { DAY_NAMES_JS } from '@/lib/dates';
import { COMPLETION_CELEBRATION_MS } from '@/lib/tracker-utils';
import { Entry, Tracker } from '@/lib/types';
import { getStreak, nextDueDate, trackerInterval } from '@/lib/utils';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    // Inline header: date label + greeting on the left, avatar on the right
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.xl,
      paddingTop: Space.screenTop,
      paddingBottom: Space.xl,
    },
    headerLeft: { flex: 1, paddingRight: Space.base },
    avatarWrapper: { alignItems: 'center' },
    avatarShadow: { marginTop: -18 },
    dateLabel: {
      fontSize: 12, fontWeight: Weight.bold, color: c.textSub,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Space.xs,
    },
    greeting: { ...Type.display, color: c.text },
    greetingName: { ...Type.display, fontFamily: FontFamily.displaySerifItalic, color: c.text },
    toggle: {
      paddingHorizontal: Space.lg, paddingVertical: Space.sm,
      borderRadius: Radius.xl, borderWidth: Border.strong, borderColor: c.border,
    },
    toggleActive: { backgroundColor: c.toggleActiveBg, borderColor: c.toggleActiveBg },
    toggleText: { fontSize: 14, fontWeight: Weight.semibold, color: c.textSub },
    toggleTextActive: { color: c.toggleActiveText },
    completedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.xl,
      paddingTop: Space.xl,
      paddingBottom: Space.xs,
    },
    completedLabel: { ...Type.label, color: c.textSub, letterSpacing: 0.4 },
    completedToggleText: { fontSize: 14, fontWeight: Weight.semibold, color: c.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space['2xl'], paddingTop: Space.screenTop },
    emptyText: { fontSize: 18, fontWeight: Weight.semibold, color: c.text },
    allDoneText: { fontSize: 22, fontWeight: Weight.bold, color: '#22c55e' },
    emptySubtext: { ...Type.bodyMd, color: c.textSub, textAlign: 'center' },
    sectionLabel: {
      ...Type.label, color: c.textSub,
      paddingHorizontal: Space.lg, paddingTop: Space.xl, paddingBottom: Space.xs,
    },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}

function dueLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export default function TodayScreen() {
  const { isLoading, trackers, entries, addEntry, updateEntry, completeEntry, deleteEntry } = useTrackers();
  // currentPeriodEntryMap is still needed here for streak computation and the main tracker handlers.
  const { currentPeriodEntryMap } = useRoutines();
  const { characterConfig, userName } = useSettings();
  const [showAll, setShowAll] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [pendingDismissIds, setPendingDismissIds] = useState<Set<string>>(new Set());
  // Ref that maps trackerId → pending dismiss timeout so each timer can be
  // cancelled individually (e.g. on unmount or rapid double-tap).
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Tick aligned to minute boundaries so routine active/inactive state updates
  // exactly when a window opens or closes, not up to 59s late.
  const [, setTick] = useState(0);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const animationsEnabled = useAnimationsEnabled();

  useEffect(() => {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setTick((n) => n + 1);
      interval = setInterval(() => setTick((n) => n + 1), 60000);
    }, msUntilNextMinute);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Clear all dismiss timers when the screen unmounts.
  useEffect(() => {
    const timers = dismissTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Floating avatar animation — slow sine-wave oscillation
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animationsEnabled) {
      floatAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: Motion.loop, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: Motion.loop, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animationsEnabled, floatAnim]);

  const avatarTranslateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const shadowOpacity = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const shadowScaleX = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] });

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

  function scheduleDismiss(trackerId: string, delay: number) {
    // Cancel any outstanding timer for the same tracker.
    const existing = dismissTimers.current.get(trackerId);
    if (existing) clearTimeout(existing);

    setPendingDismissIds((prev) => new Set([...prev, trackerId]));
    const timer = setTimeout(() => {
      dismissTimers.current.delete(trackerId);
      setPendingDismissIds((prev) => { const n = new Set(prev); n.delete(trackerId); return n; });
      setExitingIds((prev) => new Set([...prev, trackerId]));
    }, delay);
    dismissTimers.current.set(trackerId, timer);
  }

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

    const alreadyDone = isCompleted(tracker, existing);
    if (!alreadyDone && wouldComplete(tracker, value) && !showAll) {
      const delay = (tracker.type === 'boolean' || tracker.type === 'count') && tracker.reminderFrequency === 'daily' ? COMPLETION_CELEBRATION_MS : 0;
      scheduleDismiss(tracker.id, delay);
    }
    if (existing) {
      await updateEntry(existing.id, value);
    } else {
      await addEntry({ trackerId: tracker.id, value });
    }
  }, [currentPeriodEntryMap, showAll, updateEntry, addEntry]);  

  const handleComplete = useCallback(async (tracker: Tracker) => {
    const existing = currentPeriodEntryMap[tracker.id];
    if (!showAll) {
      const delay = (tracker.type === 'boolean' || tracker.type === 'count') && tracker.reminderFrequency === 'daily' ? COMPLETION_CELEBRATION_MS : 0;
      scheduleDismiss(tracker.id, delay);
    }
    if (existing) {
      await completeEntry(existing.id);
    } else {
      await addEntry({ trackerId: tracker.id, value: 0, completed: true });
    }
  }, [currentPeriodEntryMap, showAll, completeEntry, addEntry]);  

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateLabel = `${DAY_NAMES_JS[today.getDay()]} · ${MONTH_NAMES[today.getMonth()]} ${today.getDate()}`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}>
        {/* Inline header: date + greeting left, avatar right */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Text style={styles.greeting}>
              {userName ? `${greeting},\n` : greeting}
              {userName ? <Text style={styles.greetingName}>{userName}</Text> : null}
            </Text>
          </View>
          <View style={styles.avatarWrapper}>
            <Animated.View style={{ transform: [{ translateY: avatarTranslateY }] }}>
              <CharacterAvatar config={characterConfig} size={110} interactive />
            </Animated.View>
            <Animated.View style={{ opacity: shadowOpacity, transform: [{ scaleX: shadowScaleX }] }}>
              <Svg width={60} height={16} style={styles.avatarShadow}>
                <Defs>
                  <RadialGradient id="shadow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor="#000" stopOpacity={0.12} />
                    <Stop offset="100%" stopColor="#000" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={30} cy={8} rx={30} ry={8} fill="url(#shadow)" />
              </Svg>
            </Animated.View>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
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
            <Text style={styles.emptySubtext}>Tap &ldquo;Show completed&rdquo; to review your entries.</Text>
          </View>
        ) : (
          <>
            {/* Routine cards — shown all day on active days; component owns its context subscriptions */}
            <TodayRoutineList today={today} />

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
          </>
        )}

        {/* Completed section toggle + list */}
        {!isLoading && trackers.length > 0 && (
          <View style={styles.completedRow}>
            <Text style={styles.completedLabel}>{completedTrackers.length} completed</Text>
            <Pressable onPress={() => setShowAll((v) => !v)}>
              <Text style={styles.completedToggleText}>{showAll ? 'Hide' : 'Show'} →</Text>
            </Pressable>
          </View>
        )}
        {showAll && completedTrackers.length > 0 && (
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
        )}
      </ScrollView>

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
