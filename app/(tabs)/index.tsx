import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TAB_BAR_HEIGHT } from '@/components/custom-tab-bar';
import { isCompleted } from '@/components/today-tracker-list';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex, getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Entry, Routine, Tracker } from '@/lib/types';
import { DAY_NAMES_MON_FIRST } from '@/lib/dates';
import { getLogicalDay, toNumericValue } from '@/lib/utils';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
    },
    headerLeft: { flex: 1 },
    screenLabel: { fontSize: 12, fontWeight: '700', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    title: { fontSize: 30, fontWeight: '400', color: c.text, lineHeight: 34 },
    titleItalic: { fontStyle: 'italic' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 },
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
    // ── Stat chips ────────────────────────────────────────────
    statChipsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 20 },
    statChip: { flex: 1, borderRadius: 16, padding: 12 },
    statChipNumber: { fontSize: 30, fontWeight: '400', lineHeight: 32 },
    statChipLabel: {
      fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
      letterSpacing: 0.4, marginTop: 4, opacity: 0.65,
    },
    // ── Section headers ───────────────────────────────────────
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
    // ── Tracker card (manage row) ─────────────────────────────
    list: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 12,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    iconContainer: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      marginRight: 12, flexShrink: 0,
    },
    cardIcon: { fontSize: 22 },
    cardMain: { flex: 1, marginRight: 8 },
    cardName: { fontSize: 15, fontWeight: '600', color: c.text },
    cardMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 },
    typeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    typeChipText: { fontSize: 11, fontWeight: '700' },
    cardFreq: { fontSize: 12, color: c.textSub, textTransform: 'capitalize' },
    chevron: { color: c.textMuted, fontSize: 18, fontWeight: '300' },
    // ── Routine card ──────────────────────────────────────────
    routineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    routineInfo: { flex: 1 },
    routineName: { fontSize: 15, fontWeight: '600', color: c.text },
    routineMeta: { fontSize: 12, color: c.textSub, marginTop: 2 },
    // ── Empty / new button ────────────────────────────────────
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtext: { fontSize: 15, color: c.textSub },
    newTrackerBtn: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 16,
      height: 52,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    newTrackerBtnText: { fontSize: 15, fontWeight: '700', color: c.textSub },
    divider: { height: 16 },
  });
}


const TYPE_LABELS: Record<string, string> = {
  boolean: 'Yes / no',
  count: 'Count',
  range: 'Rate 1–5',
  log: 'Log',
};

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ value, label, bg, ink, styles }: {
  value: string | number;
  label: string;
  bg: string;
  ink: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: bg }]}>
      <Text style={[styles.statChipNumber, { color: ink }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: ink }]}>{label}</Text>
    </View>
  );
}

// ── Routine card ──────────────────────────────────────────────────────────────

function RoutineRow({ routine, onPress, styles }: {
  routine: Routine;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const dayLabel = routine.days.length === 7
    ? 'Every day'
    : routine.days.map((d) => DAY_NAMES_MON_FIRST[d]).join(', ');
  return (
    <Pressable style={styles.routineCard} onPress={onPress}>
      <View style={styles.routineInfo}>
        <Text style={styles.routineName}>{routine.name}</Text>
        <Text style={styles.routineMeta}>
          {formatTime(routine.startHour, routine.startMinute)} – {formatTime(routine.endHour, routine.endMinute)} · {dayLabel}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ── Tracker card ──────────────────────────────────────────────────────────────

function TrackerCard({ tracker, todayEntry, onPress, styles }: {
  tracker: Tracker;
  todayEntry: Entry | undefined;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const iconBg = getTrackerColorRgba(tracker.color, 0.15);
  const isCount = tracker.type === 'count';
  const target = tracker.target ?? 1;
  const entryNum = todayEntry ? toNumericValue(todayEntry.value) : 0;
  const done = isCompleted(tracker, todayEntry);
  const partial = isCount && !!todayEntry && entryNum > 0 && !done;

  const typeLabel = isCount ? `Count · ×${target}` : (TYPE_LABELS[tracker.type] ?? tracker.type);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Text style={styles.cardIcon}>{getTrackerIcon(tracker.icon)}</Text>
      </View>
      <View style={styles.cardMain}>
        <Text style={styles.cardName} numberOfLines={1}>{tracker.name}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.typeChip, { backgroundColor: iconBg }]}>
            <Text style={[styles.typeChipText, { color: colorHex }]}>{typeLabel}</Text>
          </View>
          <Text style={styles.cardFreq}>· {tracker.reminderFrequency ?? 'daily'}</Text>
          {(done || partial) && (
            <Text style={[styles.typeChipText, { color: colorHex }]}>
              {done ? '✓' : `${entryNum}`}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrackersScreen() {
  const { trackers, entries, mockMode, setMockMode } = useTrackers();
  const { routines } = useRoutines();
  const { today } = useCurrentDay();
  const todayStr = today.toDateString();
  const router = useRouter();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Stat chip values
  const typeCount = new Set(trackers.map((t) => t.type)).size;

  // Chip accent colors — fixed accents independent of tracker palette
  const chipAccents = [
    { bg: getTrackerColorRgba('orange', 0.15), ink: getTrackerColorHex('orange') },
    { bg: getTrackerColorRgba('teal', 0.15),   ink: getTrackerColorHex('teal')   },
    { bg: getTrackerColorRgba('purple', 0.15), ink: getTrackerColorHex('purple') },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenLabel}>Setup</Text>
          <Text style={styles.title}>Your <Text style={styles.titleItalic}>trackers</Text></Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.mockToggle, mockMode && styles.mockToggleActive]}
            onPress={() => setMockMode(!mockMode)}>
            <Text style={[styles.mockToggleText, mockMode && styles.mockToggleTextActive]}>
              Mock
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}>
        {/* Stat chips */}
        <View style={styles.statChipsRow}>
          <StatChip value={trackers.length} label="active" {...chipAccents[0]} styles={styles} />
          <StatChip value={typeCount} label="types" {...chipAccents[1]} styles={styles} />
          <StatChip value={routines.length} label="routines" {...chipAccents[2]} styles={styles} />
        </View>

        {/* Routines section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Routines</Text>
        </View>
        {routines.length > 0 && (
          <View style={[styles.list, { marginBottom: 8 }]}>
            {routines.map((routine) => (
              <RoutineRow
                key={routine.id}
                routine={routine}
                onPress={() => router.push(`/edit-routine/${routine.id}`)}
                styles={styles}
              />
            ))}
          </View>
        )}
        {!mockMode && (
          <Pressable style={styles.newTrackerBtn} onPress={() => router.push('/new-routine')}>
            <Text style={styles.newTrackerBtnText}>+ New routine</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        {/* Trackers section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Trackers</Text>
        </View>
        {trackers.length === 0 ? (
          <View style={[styles.empty, { paddingVertical: 40 }]}>
            <Text style={styles.emptyText}>No trackers yet.</Text>
            <Text style={styles.emptySubtext}>Tap below to create your first tracker.</Text>
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

        {/* New tracker button — dashed, full width */}
        {!mockMode && (
          <Pressable style={styles.newTrackerBtn} onPress={() => router.push('/new-tracker')}>
            <Text style={styles.newTrackerBtnText}>+ New tracker</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
