// Card UI for a single routine — displays its name, time window, tracker rows, and a "Mark all done" action.
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TrackerEntryRow } from '@/components/tracker-entry-row';
import { Border, Radius, Space, Type } from '@/constants/tokens';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { isCompleted } from '@/lib/tracker-utils';
import { Entry, Routine, Tracker } from '@/lib/types';
import { hexToRgb } from '@/lib/utils';

type RoutineCardProps = {
  routine: Routine;
  trackers: Tracker[];
  entryMap: Record<string, Entry>;
  isActive: boolean;
  isDone: boolean;
  onMarkAllDone: () => void;
  onSave: (tracker: Tracker, value: number) => void;
  onComplete: (tracker: Tracker) => void;
};

// Pick an emoji based on the routine's start hour
function routineEmoji(startHour: number): string {
  if (startHour < 12) return '🌅';
  if (startHour < 17) return '☀️';
  return '🌙';
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function makeStyles(c: AppTheme) {
  const { r, g, b } = hexToRgb(c.tint);
  const borderColor = `rgba(${r},${g},${b},0.25)`;
  const rowBg = c.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';

  return StyleSheet.create({
    card: {
      marginHorizontal: Space.lg,
      marginBottom: Space.md,
      borderRadius: Radius.xl,
      borderWidth: Border.hairline,
      borderColor,
      overflow: 'hidden',
      shadowColor: '#FFA34F',
      elevation: 5,
    },
    cardInner: {
      padding: Space.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.base,
      marginBottom: Space.base,
    },
    emoji: { fontSize: 26 },
    headerText: { flex: 1 },
    title: { ...Type.h2, color: c.text },
    subtitle: { ...Type.caption, color: c.textSub, marginTop: 2 },
    markAllBtn: {
      backgroundColor: c.text,
      paddingHorizontal: Space.lg,
      paddingVertical: Space.md,
      borderRadius: Radius.pill,
    },
    markAllBtnText: { ...Type.caption, fontWeight: '700', color: c.background },
    allDoneText: { fontSize: 13, fontWeight: '700', color: '#22c55e' },
    rows: { gap: Space.md },
    row: {
      backgroundColor: rowBg,
      borderRadius: Radius.lg,
      paddingHorizontal: Space.base,
      paddingVertical: Space.base,
    },
  });
}

// Gradient stops per theme — warm coral-to-gold in light, darker tinted in dark
const GRADIENT_LIGHT: [string, string] = ['#FFE4DA', '#FCE9C4'];
const GRADIENT_DARK:  [string, string] = ['#3A1E18', '#3E2D0B'];

export function RoutineCard({ routine, trackers, entryMap, isActive, isDone, onMarkAllDone, onSave, onComplete }: RoutineCardProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const gradientColors = c.scheme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

  const pendingCount = trackers.filter((t) => {
    const rt = routine.trackers.find((r) => r.id === t.id);
    return !isCompleted(t, entryMap[t.id], rt?.routineTarget);
  }).length;

  const subtitle = isActive
    ? `Until ${formatTime(routine.endHour, routine.endMinute)} · ${pendingCount} left`
    : `${formatTime(routine.startHour, routine.startMinute)} – ${formatTime(routine.endHour, routine.endMinute)}`;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardInner}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>{routineEmoji(routine.startHour)}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{routine.name}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {isDone ? (
            <Text style={styles.allDoneText}>All done ✓</Text>
          ) : (
            <Pressable
              style={styles.markAllBtn}
              onPress={onMarkAllDone}
            >
              <Text style={styles.markAllBtnText}>Mark all ✓</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.rows}>
          {trackers.map((tracker) => {
            const rt = routine.trackers.find((r) => r.id === tracker.id);
            return (
              <View key={tracker.id} style={styles.row}>
                <TrackerEntryRow
                  tracker={tracker}
                  entry={entryMap[tracker.id]}
                  streak={0}
                  showCompleted={true}
                  onSave={(value) => onSave(tracker, value)}
                  onComplete={() => onComplete(tracker)}
                  variant="inset"
                  routineTarget={rt?.routineTarget}
                />
              </View>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}
