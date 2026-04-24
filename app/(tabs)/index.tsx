// "Trackers" tab: the setup screen that lists all trackers and routines
// plus a few summary stat chips. Shell view above the scroll list handles
// the page title and Mock-mode toggle.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TAB_BAR_HEIGHT } from '@/components/custom-tab-bar';
import { isCompleted } from '@/components/today-tracker-list';
import { Border, Radius, Shadow, Size, Space, Type, Weight } from '@/constants/tokens';
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
      paddingHorizontal: Space.xl,
      paddingTop: Space.screenTop,
      paddingBottom: Space.lg,
    },
    headerLeft: { flex: 1 },
    screenLabel: { fontSize: 12, fontWeight: Weight.bold, color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Space.xs },
    title: { ...Type.display, color: c.text },
    titleItalic: { fontStyle: 'italic' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Space.base, paddingTop: Space.sm },
    mockToggle: {
      paddingHorizontal: Space.base,
      paddingVertical: Space.sm,
      borderRadius: Radius.lg,
      borderWidth: Border.strong,
      borderColor: c.border,
    },
    mockToggleActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
    mockToggleText: { fontSize: 13, fontWeight: Weight.semibold, color: c.textSub },
    mockToggleTextActive: { color: '#fff' },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: Radius.lg,
      backgroundColor: c.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontSize: 22, lineHeight: 26 },
    // ── Stat chips ────────────────────────────────────────────
    statChipsRow: { flexDirection: 'row', gap: Space.base, paddingHorizontal: Space.lg, paddingBottom: Space.xl },
    statChip: { flex: 1, borderRadius: Radius.lg, padding: Space.base },
    statChipNumber: { ...Type.display, lineHeight: 32 },
    statChipLabel: {
      ...Type.overline, letterSpacing: 0.4, marginTop: Space.xs, opacity: 0.65,
    },
    // ── Section headers ───────────────────────────────────────
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.lg,
      paddingTop: Space.xs,
      paddingBottom: Space.base,
    },
    sectionTitle: { ...Type.label, color: c.textSub },
    // ── Tracker card (manage row) ─────────────────────────────
    list: { paddingHorizontal: Space.lg, gap: Space.base, paddingBottom: Space.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.base,
      ...Shadow.card,
    },
    iconContainer: {
      width: Size.iconBg, height: Size.iconBg, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
      marginRight: Space.base, flexShrink: 0,
    },
    cardIcon: { fontSize: 22 },
    cardMain: { flex: 1, marginRight: Space.md },
    cardName: { ...Type.bodyMd, color: c.text },
    cardMeta: { flexDirection: 'row', gap: Space.sm, alignItems: 'center', marginTop: 3 },
    typeChip: { paddingHorizontal: Space.md, paddingVertical: 2, borderRadius: Radius.pill },
    typeChipText: { fontSize: 11, fontWeight: Weight.bold },
    cardFreq: { ...Type.caption, color: c.textSub, textTransform: 'capitalize' },
    chevron: { color: c.textMuted, fontSize: 18, fontWeight: '300' },
    // ── Routine card ──────────────────────────────────────────
    routineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.lg,
      ...Shadow.card,
    },
    routineInfo: { flex: 1 },
    routineName: { ...Type.bodyMd, color: c.text },
    routineMeta: { ...Type.caption, color: c.textSub, marginTop: 2 },
    // ── Empty / new button ────────────────────────────────────
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md },
    emptyText: { fontSize: 18, fontWeight: Weight.semibold, color: c.text },
    emptySubtext: { ...Type.bodyMd, color: c.textSub },
    newTrackerBtn: {
      marginHorizontal: Space.lg,
      marginTop: Space.xs,
      marginBottom: Space.lg,
      height: Size.controlLg,
      borderRadius: Radius.xl,
      borderWidth: Border.strong,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    newTrackerBtnText: { fontSize: 15, fontWeight: Weight.bold, color: c.textSub },
    divider: { height: Space.lg },
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
