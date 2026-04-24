// Scrolling list of tracker rows with enter/exit animations and a rebound
// effect for siblings when a row completes and dismisses.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AnimatedExitRow, ReboundTrigger, reboundDelay } from '@/components/animated-exit-row';
import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useTheme } from '@/hooks/use-theme';
import { Entry, Tracker } from '@/lib/types';

import { isCompleted, wouldComplete } from './today-tracker-list-action';
import { makeTodayTrackerListStyles } from './today-tracker-list-styles';

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
      {displayList.map((item, index) => (
        <AnimatedExitRow
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
        </AnimatedExitRow>
      ))}
    </ScrollView>
  );
}
