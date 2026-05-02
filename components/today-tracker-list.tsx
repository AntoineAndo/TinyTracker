// Scrolling list of tracker rows with enter/exit animations and a rebound
// effect for siblings when a row completes and dismisses. When `onDismiss`
// is provided, each row also accepts a left-swipe gesture to hide it for the
// rest of the logical day.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { AnimatedExitRow, ReboundTrigger, reboundDelay } from '@/components/animated-exit-row';
import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { Space, Type } from '@/constants/tokens';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { Entry, Tracker } from '@/lib/types';

import { isCompleted, wouldComplete } from './today-tracker-list-action';
import { makeTodayTrackerListStyles } from './today-tracker-list-styles';

// Visual width of the label area. The action container itself spans the full
// screen so a confirmed swipe settles the row entirely off-screen; the label
// is right-aligned within the first `LABEL_WIDTH` so it reads next to the row
// as it slides away.
const LABEL_WIDTH = 150;
// Threshold to confirm dismissal. A short flick is enough.
const SWIPE_THRESHOLD = LABEL_WIDTH / 2;
const SCREEN_WIDTH = Dimensions.get('window').width;

function makeSwipeStyles(c: AppTheme) {
  return StyleSheet.create({
    action: {
      width: SCREEN_WIDTH,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    labelContainer: {
      width: LABEL_WIDTH,
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: Space.lg,
    },
    actionLabel: {
      ...Type.label,
      color: c.textSub,
      textAlign: 'right',
    },
  });
}

export { isCompleted, wouldComplete };

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
  /** When provided, rows accept a left-swipe gesture that calls this with the
   *  tracker id. The parent is responsible for animating the row out and
   *  persisting the dismissal. */
  onDismiss?: (trackerId: string) => void;
};

export function TodayTrackerList({ trackers, entryMap, streakMap, showCompleted, forcedCompletedIds, exitingIds, pendingDismissIds, onSave, onComplete, onEdit, onExited, onDismiss }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeTodayTrackerListStyles(c), [c]);
  const swipeStyles = useMemo(() => makeSwipeStyles(c), [c]);
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
    if (newlyExiting.length === 0) {
      prevExitingRef.current = new Set(exitingIds);
      return;
    }

    const list = displayListRef.current;
    const updates: Record<string, ReboundTrigger> = {};

    for (const exitId of newlyExiting) {
      const exitIndex = list.findIndex((t) => t.id === exitId);
      if (exitIndex === -1) continue;
      list.forEach((t, i) => {
        if (i > exitIndex && !exitingIds.has(t.id)) {
          const version = (reboundVersionsRef.current[t.id] ?? 0) + 1;
          reboundVersionsRef.current[t.id] = version;
          updates[t.id] = { version, delay: reboundDelay(i - exitIndex - 1) };
        }
      });
    }

    prevExitingRef.current = new Set(exitingIds);

    if (Object.keys(updates).length > 0) {
      setReboundMap((prev) => ({ ...prev, ...updates }));
    }
  }, [exitingIds]);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {displayList.map((item, index) => {
        const row = (
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
        );

        // Pending rows are swipeable. We deliberately keep the Swipeable
        // mounted while the row is exiting so the row stays at its settled
        // off-screen position while `AnimatedExitRow` collapses the height.
        // Unmounting it would snap the row back onto the screen mid-collapse.
        const swipeable = onDismiss && !isCompleted(item, entryMap[item.id]);

        return (
          <AnimatedExitRow
            key={item.id}
            exiting={exitingIds.has(item.id)}
            onExited={() => onExited(item.id)}
            animationsEnabled={animationsEnabled}
            rebound={reboundMap[item.id]}
          >
            {swipeable ? (
              <Swipeable
                renderRightActions={(progress) => {
                  // `progress` reaches 1 when the row is fully open (off
                  // screen). Reaching the dismiss threshold corresponds to
                  // dragging past `SWIPE_THRESHOLD / SCREEN_WIDTH` of the
                  // action width — fade the label in over that range.
                  const thresholdRatio = SWIPE_THRESHOLD / SCREEN_WIDTH;
                  const opacity = progress.interpolate({
                    inputRange: [0, thresholdRatio / 2, thresholdRatio],
                    outputRange: [0, 0.4, 1],
                    extrapolate: 'clamp',
                  });
                  return (
                    <View style={swipeStyles.action}>
                      <View style={swipeStyles.labelContainer}>
                        <Animated.Text style={[swipeStyles.actionLabel, { opacity }]}>
                          Hide for{'\n'}today
                        </Animated.Text>
                      </View>
                    </View>
                  );
                }}
                rightThreshold={SWIPE_THRESHOLD}
                friction={1.5}
                overshootRight={false}
                onSwipeableWillOpen={() => onDismiss(item.id)}
              >
                {row}
              </Swipeable>
            ) : (
              row
            )}
            {index < displayList.length - 1 && <View style={styles.separator} />}
          </AnimatedExitRow>
        );
      })}
    </ScrollView>
  );
}
