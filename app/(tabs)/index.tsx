import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isCompleted } from '@/components/today-tracker-list';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Entry, Routine, Tracker } from '@/lib/types';
import { getLogicalDay, toNumericValue } from '@/lib/utils';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mockToggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    mockToggleActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
    mockToggleText: { fontSize: 13, fontWeight: '600', color: c.textSub },
    mockToggleTextActive: { color: '#fff' },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontSize: 22, lineHeight: 26 },
    list: { padding: 16, gap: 12 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.cardAlt,
      borderRadius: 12,
      overflow: 'hidden',
    },
    colorStrip: { width: 5, alignSelf: 'stretch' },
    cardIcon: { fontSize: 24, paddingLeft: 12, paddingVertical: 16, width: 48, textAlign: 'center' },
    cardMain: { flex: 1, padding: 16 },
    cardName: { fontSize: 17, fontWeight: '600', marginBottom: 6, color: c.text },
    cardMeta: { flexDirection: 'row', gap: 8 },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeSecondary: { backgroundColor: c.textSub },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
    doneIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      marginHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneCheck: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtext: { fontSize: 15, color: c.textSub },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionAddBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.tint,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionAddBtnText: { color: '#fff', fontSize: 18, lineHeight: 22 },
    routineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 10,
    },
    routineInfo: { flex: 1 },
    routineName: { fontSize: 15, fontWeight: '600', color: c.text },
    routineMeta: { fontSize: 12, color: c.textSub, marginTop: 2 },
    routineChevron: { fontSize: 16, color: c.textSub },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginTop: 8 },
  });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function RoutineRow({ routine, onPress, styles }: {
  routine: Routine;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const dayLabel = routine.days.length === 7
    ? 'Every day'
    : routine.days.map((d) => DAY_LABELS[d]).join(', ');
  return (
    <Pressable style={styles.routineRow} onPress={onPress}>
      <View style={styles.routineInfo}>
        <Text style={styles.routineName}>{routine.name}</Text>
        <Text style={styles.routineMeta}>
          {formatTime(routine.startHour, routine.startMinute)} – {formatTime(routine.endHour, routine.endMinute)} · {dayLabel}
        </Text>
      </View>
      <Text style={styles.routineChevron}>›</Text>
    </Pressable>
  );
}

function TrackerCard({ tracker, todayEntry, onPress, styles }: {
  tracker: Tracker;
  todayEntry: Entry | undefined;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const isCount = tracker.type === 'count';
  const target = tracker.target ?? 1;
  const entryNum = todayEntry ? toNumericValue(todayEntry.value) : 0;
  const done = isCompleted(tracker, todayEntry);
  const partial = isCount && !!todayEntry && entryNum > 0 && !done;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.colorStrip, { backgroundColor: colorHex }]} />
      <Text style={styles.cardIcon}>{getTrackerIcon(tracker.icon)}</Text>
      <View style={styles.cardMain}>
        <Text style={styles.cardName}>{tracker.name}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.badge, { backgroundColor: colorHex }]}>
            <Text style={styles.badgeText}>
              {tracker.type === 'boolean' ? 'Yes/No' : isCount ? `×${target}` : '1–5'}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.doneIndicator, done && { backgroundColor: colorHex }, partial && { borderColor: colorHex }]}>
        {done && <Text style={styles.doneCheck}>✓</Text>}
        {partial && <Text style={[styles.doneCheck, { color: colorHex, fontSize: 11 }]}>{entryNum}</Text>}
      </View>
    </Pressable>
  );
}

export default function TrackersScreen() {
  const { trackers, entries, mockMode, setMockMode } = useTrackers();
  const { routines } = useRoutines();
  const { today } = useCurrentDay();
  const todayStr = today.toDateString();
  const router = useRouter();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trackers</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.mockToggle, mockMode && styles.mockToggleActive]}
            onPress={() => setMockMode(!mockMode)}>
            <Text style={[styles.mockToggleText, mockMode && styles.mockToggleTextActive]}>
              Mock
            </Text>
          </Pressable>
          {!mockMode && (
            <Pressable style={styles.addButton} onPress={() => router.push('/new-tracker')}>
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView>
        {/* Routines section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Routines</Text>
          {!mockMode && (
            <Pressable style={styles.sectionAddBtn} onPress={() => router.push('/new-routine')}>
              <Text style={styles.sectionAddBtnText}>+</Text>
            </Pressable>
          )}
        </View>
        {routines.length === 0 ? (
          <Text style={[styles.emptySubtext, { paddingHorizontal: 16, paddingBottom: 8 }]}>
            No routines yet. Tap + to group trackers into a routine.
          </Text>
        ) : (
          routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              onPress={() => router.push(`/edit-routine/${routine.id}`)}
              styles={styles}
            />
          ))
        )}

        <View style={styles.divider} />

        {/* Trackers section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Trackers</Text>
        </View>
        {trackers.length === 0 ? (
          <View style={[styles.empty, { paddingVertical: 40 }]}>
            <Text style={styles.emptyText}>No trackers yet.</Text>
            <Text style={styles.emptySubtext}>Tap + to create your first tracker.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {trackers.map((item) => {
              const todayEntry = entries.find(
                (e) => e.trackerId === item.id && getLogicalDay(new Date(e.createdAt), e.dayStartHour ?? 0).toDateString() === todayStr,
              );
              return (
                <TrackerCard
                  key={item.id}
                  tracker={item}
                  todayEntry={todayEntry}
                  onPress={() => router.push(`/tracker/${item.id}`)}
                  styles={styles}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
