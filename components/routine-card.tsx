import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isCompleted } from '@/components/today-tracker-list-action';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { Entry, Routine, Tracker } from '@/lib/types';

type RoutineCardProps = {
  routine: Routine;
  /** Pre-filtered to only the trackers in this routine (preserves order). */
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  /** True when current wall-clock time is within the routine's [start, end) window. */
  isActive: boolean;
  isCompleted: boolean;
  onMarkAllDone: () => void;
  onPress: () => void;
};

function makeStyles(c: AppTheme, isActive: boolean, isCompleted: boolean) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 14,
      backgroundColor: c.cardAlt,
      borderWidth: isActive ? 1.5 : 1,
      borderColor: isActive ? c.tint : c.border,
      overflow: 'hidden',
      opacity: isCompleted && !isActive ? 0.7 : 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    activeDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: c.tint,
    },
    title: {
      flex: 1,
      fontSize: 15, fontWeight: '700',
      color: isActive ? c.tint : c.text,
    },
    timeLabel: {
      fontSize: 12, color: c.textSub, fontWeight: '500',
    },
    trackerChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: c.segmentBg,
      gap: 4,
    },
    chipDone: { backgroundColor: c.segmentActiveBg },
    chipText: { fontSize: 13, color: c.textSub },
    chipTextDone: { color: c.text },
    chipCheck: { fontSize: 11, color: c.tint, fontWeight: '700' },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 4,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    completedText: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
    markDoneBtn: {
      backgroundColor: c.tint,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
    },
    markDoneBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  });
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function RoutineCard({ routine, trackers, entryMap, isActive, isCompleted: done, onMarkAllDone, onPress }: RoutineCardProps) {
  const c = useTheme();
  const styles = makeStyles(c, isActive, done);

  const timeLabel = isActive
    ? `Until ${formatTime(routine.endHour, routine.endMinute)}`
    : `${formatTime(routine.startHour, routine.startMinute)} – ${formatTime(routine.endHour, routine.endMinute)}`;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        {isActive && <View style={styles.activeDot} />}
        <Text style={styles.title}>{routine.name}</Text>
        <Text style={styles.timeLabel}>{timeLabel}</Text>
      </View>

      <View style={styles.trackerChips}>
        {trackers.map((tracker) => {
          const completed = isCompleted(tracker, entryMap[tracker.id]);
          return (
            <View key={tracker.id} style={[styles.chip, completed && styles.chipDone]}>
              {completed && <Text style={styles.chipCheck}>✓</Text>}
              <Text style={[styles.chipText, completed && styles.chipTextDone]}>
                {tracker.name}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        {done ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>All done!</Text>
          </View>
        ) : (
          <View />
        )}
        {!done && (
          <Pressable
            style={styles.markDoneBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onMarkAllDone();
            }}>
            <Text style={styles.markDoneBtnText}>Mark all done</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
