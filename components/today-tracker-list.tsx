// Scrolling list of tracker rows with enter/exit animations and a rebound
// effect for siblings when a row completes and dismisses.
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, View } from 'react-native';

import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { Motion } from '@/constants/tokens';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useTheme } from '@/hooks/use-theme';
import { Entry, Tracker } from '@/lib/types';

import { isCompleted, wouldComplete } from './today-tracker-list-action';
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
      Animated.timing(opacityAnim, { toValue: 0, duration: Motion.base, useNativeDriver: false }),
      Animated.timing(heightAnim, { toValue: 0, duration: Motion.slow, useNativeDriver: false }),
    ]).start(() => onExitedRef.current());
  }, [fixedHeight, heightAnim, opacityAnim]);

  useEffect(() => {
    if (!rebound || rebound.version === prevReboundVersion.current) return;
    prevReboundVersion.current = rebound.version;
    if (!animationsEnabled) return;
    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.timing(springAnim, { toValue: -9, duration: Motion.fast, useNativeDriver: true }),
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

// ── TodayTrackerList ──────────────────────────────────────────────────────────

type Props = {
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  streakMap: Record<string, number>;
  showCompleted: boolean;
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
          <TrackerEntryRow
            tracker={item}
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
            variant="card"
          />
          {index < displayList.length - 1 && <View style={styles.separator} />}
        </AnimatedRow>
      ))}
    </ScrollView>
  );
}
