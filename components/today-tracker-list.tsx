import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Entry, Tracker } from '@/lib/types';

import { CompletedValue, isCompleted, QuickAction, wouldComplete } from './today-tracker-list-action';
import { makeTodayTrackerListStyles } from './today-tracker-list-styles';

export { isCompleted, wouldComplete };

// ── AnimatedRow ───────────────────────────────────────────────────────────────

type ReboundTrigger = { version: number; delay: number };

const STIFFNESS = 280;
const DAMPING = 17;
const MASS = 0.7;

function AnimatedRow({ children, exiting, onExited, animationsEnabled, rebound }: {
  children: ReactNode;
  exiting: boolean;
  onExited: () => void;
  animationsEnabled: boolean;
  rebound?: ReboundTrigger;
}) {
  const measuredHeight = useRef<number | null>(null);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const springAnim = useRef(new Animated.Value(0)).current;
  const [fixedHeight, setFixedHeight] = useState(false);
  const exitStarted = useRef(false);
  const prevReboundVersion = useRef<number | undefined>(undefined);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (!exiting || exitStarted.current) return;
    exitStarted.current = true;
    if (!animationsEnabled || measuredHeight.current === null) {
      onExitedRef.current();
      return;
    }
    heightAnim.setValue(measuredHeight.current);
    setFixedHeight(true);
  }, [exiting, animationsEnabled, heightAnim]);

  useEffect(() => {
    if (!fixedHeight) return;
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(heightAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start(() => onExitedRef.current());
  }, [fixedHeight, heightAnim, opacityAnim]);

  useEffect(() => {
    if (!rebound || rebound.version === prevReboundVersion.current) return;
    prevReboundVersion.current = rebound.version;
    if (!animationsEnabled) return;
    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.timing(springAnim, { toValue: -9, duration: 90, useNativeDriver: true }),
        Animated.spring(springAnim, { toValue: 0, useNativeDriver: true, stiffness: STIFFNESS, damping: DAMPING, mass: MASS }),
      ]).start();
    }, rebound.delay);
    return () => clearTimeout(timeout);
  }, [rebound?.version, animationsEnabled, springAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: springAnim }] }}>
      <Animated.View
        style={fixedHeight ? { height: heightAnim, overflow: 'hidden', opacity: opacityAnim } : undefined}
        onLayout={(e) => {
          if (measuredHeight.current === null && !exiting) {
            measuredHeight.current = e.nativeEvent.layout.height;
          }
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// ── TrackerRow ────────────────────────────────────────────────────────────────

type RowStyles = ReturnType<typeof makeTodayTrackerListStyles>;

function TrackerRow({ tracker, entry, streak, showCompleted, isPendingDismiss, onSave, onComplete, onEdit, styles }: {
  tracker: Tracker;
  entry: Entry | undefined;
  streak: number;
  showCompleted: boolean;
  isPendingDismiss: boolean;
  onSave: (value: number) => void;
  onComplete: () => void;
  onEdit?: () => void;
  styles: RowStyles;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const done = isCompleted(tracker, entry) && !isPendingDismiss;

  const rowContent = (
    <>
      <View style={[styles.colorStrip, { backgroundColor: colorHex }]} />
      <Text style={styles.rowIcon}>{getTrackerIcon(tracker.icon)}</Text>
      <View style={styles.rowNameContainer}>
        <Text style={[styles.rowName, done && styles.rowNameDone]} numberOfLines={1}>{tracker.name}</Text>
        <StreakBadge streak={streak} />
      </View>
      <View style={styles.rowAction}>
        {done && showCompleted
          ? <CompletedValue tracker={tracker} entry={entry!} styles={styles} />
          : !done
          ? <QuickAction tracker={tracker} entry={entry} onSave={onSave} onComplete={onComplete} styles={styles} />
          : null}
      </View>
    </>
  );

  if (done && showCompleted && onEdit) {
    return (
      <Pressable style={[styles.row, styles.rowDone]} onPress={onEdit}>
        {rowContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, done && styles.rowDone]}>
      {rowContent}
    </View>
  );
}

// ── TodayTrackerList ──────────────────────────────────────────────────────────

type Props = {
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  streakMap: Record<string, number>;
  showCompleted: boolean;
  // Completed non-daily trackers that are approaching their next due date and
  // should remain visible in their date section (shown with completed styling).
  forcedCompletedIds?: Set<string>;
  exitingIds: Set<string>;
  pendingDismissIds: Set<string>;
  onSave: (tracker: Tracker, value: number) => void;
  onComplete: (tracker: Tracker) => void;
  onEdit: (tracker: Tracker, entry: Entry) => void;
  onExited: (trackerId: string) => void;
};

export function TodayTrackerList({ trackers, entryMap, streakMap, showCompleted, forcedCompletedIds, exitingIds, pendingDismissIds, onSave, onComplete, onEdit, onExited }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeTodayTrackerListStyles(c), [c]);
  const animationsEnabled = useAnimationsEnabled();

  const displayList = showCompleted
    ? [
        ...trackers.filter((t) => !isCompleted(t, entryMap[t.id])),
        ...trackers.filter((t) => isCompleted(t, entryMap[t.id])),
      ]
    : trackers.filter(
        (t) =>
          !isCompleted(t, entryMap[t.id]) ||
          exitingIds.has(t.id) ||
          pendingDismissIds.has(t.id) ||
          // Completed non-daily trackers in the second half of their period
          // remain in the date section so the user knows the next due date is
          // approaching (even though they already logged this period).
          forcedCompletedIds?.has(t.id),
      );

  const displayListRef = useRef(displayList);
  displayListRef.current = displayList;

  const [reboundMap, setReboundMap] = useState<Record<string, ReboundTrigger>>({});
  const reboundVersionsRef = useRef<Record<string, number>>({});
  const prevExitingRef = useRef(new Set<string>());

  useEffect(() => {
    const newlyExiting = [...exitingIds].filter((id) => !prevExitingRef.current.has(id));
    prevExitingRef.current = new Set(exitingIds);
    if (newlyExiting.length === 0) return;

    const list = displayListRef.current;
    const updates: Record<string, ReboundTrigger> = {};

    for (const exitId of newlyExiting) {
      const exitIndex = list.findIndex((t) => t.id === exitId);
      if (exitIndex === -1) continue;
      list.forEach((t, i) => {
        if (i > exitIndex && !exitingIds.has(t.id)) {
          const version = (reboundVersionsRef.current[t.id] ?? 0) + 1;
          reboundVersionsRef.current[t.id] = version;
          updates[t.id] = { version, delay: 60 + (i - exitIndex - 1) * 40 };
        }
      });
    }

    if (Object.keys(updates).length > 0) {
      setReboundMap((prev) => ({ ...prev, ...updates }));
    }
  }, [exitingIds]);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {displayList.map((item, index) => (
        <AnimatedRow
          key={item.id}
          exiting={exitingIds.has(item.id)}
          onExited={() => onExited(item.id)}
          animationsEnabled={animationsEnabled}
          rebound={reboundMap[item.id]}
        >
          <TrackerRow
            tracker={item}
            // Forced-completed trackers appear as fresh entries so they show action
            // buttons rather than completed styling — the actual entry update still
            // happens via handleSave/handleComplete which use currentPeriodEntryMap.
            entry={forcedCompletedIds?.has(item.id) ? undefined : entryMap[item.id]}
            streak={streakMap[item.id] ?? 0}
            showCompleted={showCompleted}
            isPendingDismiss={pendingDismissIds.has(item.id)}
            onSave={(value) => onSave(item, value)}
            onComplete={() => onComplete(item)}
            onEdit={() => {
              const entry = entryMap[item.id];
              if (entry) onEdit(item, entry);
            }}
            styles={styles}
          />
          {index < displayList.length - 1 && <View style={styles.separator} />}
        </AnimatedRow>
      ))}
    </ScrollView>
  );
}
