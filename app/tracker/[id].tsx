// Tracker detail screen: today's primary input (ring for count, input for
// log, buttons for boolean/range) plus a paginated history list.
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedButton } from '@/components/animated-button';
import { EditEntryDrawer } from '@/components/edit-entry-drawer';
import { Border, Radius, Shadow, Space, Type, Weight } from '@/constants/tokens';
import { useTrackers } from '@/context/trackers-context';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { useCurrentDay } from '@/hooks/use-current-day';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { Entry, Tracker } from '@/lib/types';
import { getLogicalDay, isSameDay } from '@/lib/utils';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(entry: Entry, type: string, target?: number): string {
  if (type === 'boolean') return (entry.value === true || entry.value === 1) ? 'Yes' : 'No';
  if (type === 'count' && target !== undefined) return `${entry.value} / ${target}`;
  if (type === 'log') return entry.completed ? `${entry.value} ✓` : String(entry.value);
  return String(entry.value);
}

// ── Animated SVG circle ────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Count entry UI ─────────────────────────────────────────────────────────────

const RING_SIZE = 220;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const BTN_SIZE = RING_SIZE * 0.58;

function CountEntryUI({ target, colorHex, initialCount, onSave, onLongPress, c }: {
  target: number;
  colorHex: string;
  initialCount: number;
  onSave: (value: number) => void;
  onLongPress?: () => void;
  c: AppTheme;
}) {
  const animationsEnabled = useAnimationsEnabled();
  const [count, setCount] = useState(initialCount);
  const progressAnim = useRef(new Animated.Value(initialCount / target)).current;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  useEffect(() => {
    setCount(initialCount);
    progressAnim.setValue(initialCount / target);
  }, [initialCount]);

  function handleIncrement() {
    if (count >= target) return;
    const next = count + 1;
    setCount(next);
    if (animationsEnabled) {
      progressAnim.stopAnimation();
      Animated.spring(progressAnim, { toValue: next / target, useNativeDriver: false, tension: 120, friction: 8 }).start();
    } else {
      progressAnim.setValue(next / target);
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(next), 500);
  }

  const strokeDashoffset = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });
  const strokeOpacity = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const atTarget = count >= target;

  return (
    <View style={countStyles.container}>
      <View style={countStyles.ringWrapper}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={c.cellEmpty} strokeWidth={STROKE} fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={colorHex} strokeWidth={STROKE} fill="none"
            strokeOpacity={strokeOpacity}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <AnimatedButton
          style={[countStyles.btn, { backgroundColor: colorHex }]}
          onPress={handleIncrement}
          onLongPress={onLongPress}
          disabled={atTarget && !onLongPress}>
          <Text style={countStyles.btnText} pointerEvents="none">
            {atTarget ? '✓' : '+ 1'}
          </Text>
        </AnimatedButton>
      </View>
      <View style={countStyles.labelRow}>
        <Text style={countStyles.countNum}>
          <Text style={{ color: atTarget ? colorHex : c.text }}>{count}</Text>
          <Text style={[countStyles.countTarget, { color: c.textMuted }]}> / {target}</Text>
        </Text>
      </View>
    </View>
  );
}

// ── Log entry UI ───────────────────────────────────────────────────────────────

function LogEntryUI({ tracker, colorHex, todayEntry, onAdd, onComplete, onLongPress, c }: {
  tracker: Tracker;
  colorHex: string;
  todayEntry: Entry | undefined;
  onAdd: (amount: number) => void;
  onComplete: () => void;
  onLongPress?: () => void;
  c: AppTheme;
}) {
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const isComplete = todayEntry?.completed === true;
  const currentTotal = todayEntry ? (todayEntry.value as number) : 0;

  function confirmAdd() {
    const amount = parseFloat(inputVal);
    if (!isNaN(amount) && amount > 0) onAdd(amount);
    setInputVal('');
    setAdding(false);
  }

  return (
    <View style={logStyles.container}>
      <Pressable style={logStyles.totalWrapper} onLongPress={onLongPress}>
        {isComplete && <Text style={[logStyles.checkmark, { color: colorHex }]}>✓</Text>}
        <Text style={[logStyles.total, { color: isComplete ? colorHex : c.text }]}>
          {currentTotal}
        </Text>
        {(tracker.min !== undefined || tracker.max !== undefined) && (
          <Text style={[logStyles.reference, { color: c.textMuted }]}>
            {[
              tracker.min !== undefined && `min ${tracker.min}`,
              tracker.max !== undefined && `max ${tracker.max}`,
            ].filter(Boolean).join('  ·  ')}
          </Text>
        )}
      </Pressable>

      {!isComplete && (
        adding ? (
          <View style={logStyles.inputRow}>
            <TextInput
              style={[logStyles.input, { borderColor: colorHex, color: c.text, backgroundColor: c.surface }]}
              value={inputVal}
              onChangeText={setInputVal}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmAdd}
              placeholder="0"
              placeholderTextColor={c.textMuted}
            />
            <AnimatedButton
              style={[logStyles.confirmBtn, { backgroundColor: colorHex }]}
              onPress={confirmAdd}>
              <Text style={logStyles.confirmBtnText}>✓</Text>
            </AnimatedButton>
          </View>
        ) : (
          <View style={logStyles.actionsRow}>
            <AnimatedButton
              style={[logStyles.addBtn, { borderColor: colorHex }]}
              onPress={() => setAdding(true)}>
              <Text style={[logStyles.addBtnText, { color: colorHex }]}>+ Add</Text>
            </AnimatedButton>
            <AnimatedButton
              style={[logStyles.doneBtn, { backgroundColor: colorHex }]}
              onPress={onComplete}>
              <Text style={logStyles.doneBtnText}>Done</Text>
            </AnimatedButton>
          </View>
        )
      )}
    </View>
  );
}

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: 16, color: c.textSub },
    inputSection: {
      padding: Space.xl, gap: Space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    inputLabel: { ...Type.body, color: c.text },
    alreadyLogged: { borderWidth: Border.strong, borderRadius: Radius.md, paddingVertical: Space.lg, alignItems: 'center' },
    alreadyLoggedText: { ...Type.bodyMd },
    boolRow: { flexDirection: 'row', gap: Space.base },
    boolButton: {
      flex: 1, paddingVertical: Space.lg, borderRadius: Radius.md,
      borderWidth: Border.emphasis, borderColor: c.border, alignItems: 'center',
    },
    boolButtonText: { ...Type.body, color: c.textSub },
    rangeRow: { flexDirection: 'row', gap: Space.base },
    rangeButton: {
      flex: 1, aspectRatio: 1, borderRadius: Radius.md,
      borderWidth: Border.emphasis, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    rangeButtonText: { fontSize: 18, fontWeight: Weight.bold, color: c.textSub },
    rangeButtonTextActive: { color: '#fff' },
    saveButton: { borderRadius: Radius.md, paddingVertical: Space.lg, alignItems: 'center' },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { ...Type.body, color: '#fff' },
    historyTitle: {
      ...Type.label, fontSize: 16, color: c.textSub,
      paddingHorizontal: Space.xl, paddingTop: Space.xl, paddingBottom: Space.md,
    },
    historyList: { paddingHorizontal: Space.xl },
    noEntries: { paddingHorizontal: Space.xl, fontSize: 14, color: c.textMuted },
    loadMoreBtn: { paddingVertical: Space.lg, alignItems: 'center' as const },
    loadMoreText: { fontSize: 15, color: c.tint, fontWeight: Weight.medium },
    entryRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: Space.base,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight,
      gap: Space.base,
    },
    entryDate: { flex: 1, fontSize: 15, color: c.textSub },
    entryArrow: { fontSize: 14, color: c.textMuted },
    entryValue: { ...Type.body, minWidth: 36, textAlign: 'right' },
    entryChevron: { fontSize: 20, color: c.textMuted, marginLeft: Space.xs },
    editButton: { fontSize: 16, color: c.tint, fontWeight: Weight.medium },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TrackerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { trackers, entries, hasMoreEntries, loadMoreEntries, addEntry, updateEntry, completeEntry, deleteEntry } = useTrackers();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const tracker = trackers.find((t) => t.id === id) as Tracker | undefined;
  const trackerEntries = entries
    .filter((e) => e.trackerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const { today } = useCurrentDay();
  const todayEntry = trackerEntries.find((e) => isSameDay(getLogicalDay(new Date(e.createdAt), e.dayStartHour ?? 0), today));
  const hasEntryToday = !!todayEntry;

  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (tracker) {
      navigation.setOptions({
        title: tracker.name,
        headerRight: () => (
          <Pressable onPress={() => router.push(`/edit-tracker/${id}`)} hitSlop={12}>
            <Text style={styles.editButton}>Edit</Text>
          </Pressable>
        ),
      });
    }
  }, [tracker, navigation, router, id, styles]);

  if (!tracker) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Tracker not found.</Text>
      </View>
    );
  }

  const colorHex = getTrackerColorHex(tracker.color);
  const isCount = tracker.type === 'count';
  const isLog = tracker.type === 'log';
  const target = tracker.target ?? 1;

  async function handleSave(value: number) {
    if (todayEntry) {
      await updateEntry(todayEntry.id, value);
    } else {
      await addEntry({ trackerId: id, value });
    }
    setSelectedValue(null);
  }

  async function handleLogAdd(amount: number) {
    const currentTotal = todayEntry ? (todayEntry.value as number) : 0;
    const newTotal = currentTotal + amount;
    if (todayEntry) {
      await updateEntry(todayEntry.id, newTotal);
    } else {
      await addEntry({ trackerId: id, value: newTotal });
    }
  }

  async function handleLogComplete() {
    if (todayEntry) {
      await completeEntry(todayEntry.id);
    } else {
      await addEntry({ trackerId: id, value: 0, completed: true });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        {isCount ? (
          <CountEntryUI
            target={target}
            colorHex={colorHex}
            initialCount={todayEntry ? (todayEntry.value as number) : 0}
            onSave={handleSave}
            onLongPress={todayEntry ? () => setEditingEntry(todayEntry) : undefined}
            c={c}
          />
        ) : isLog ? (
          <LogEntryUI
            tracker={tracker}
            colorHex={colorHex}
            todayEntry={todayEntry}
            onAdd={handleLogAdd}
            onComplete={handleLogComplete}
            onLongPress={todayEntry ? () => setEditingEntry(todayEntry) : undefined}
            c={c}
          />
        ) : hasEntryToday ? (
          <View style={[styles.alreadyLogged, { borderColor: colorHex }]}>
            <Text style={[styles.alreadyLoggedText, { color: colorHex }]}>Already logged today</Text>
          </View>
        ) : (
          <>
            <Text style={styles.inputLabel}>
              {tracker.type === 'boolean' ? 'Did you do it today?' : 'Rate it today (1–5)'}
            </Text>
            {tracker.type === 'boolean' ? (
              <View style={styles.boolRow}>
                {([true, false] as const).map((v) => (
                  <Pressable
                    key={String(v)}
                    style={[styles.boolButton, selectedValue === (v ? 1 : 0) && { borderColor: colorHex, backgroundColor: colorHex + '18' }]}
                    onPress={() => setSelectedValue(v ? 1 : 0)}>
                    <Text style={[styles.boolButtonText, selectedValue === (v ? 1 : 0) && { color: colorHex }]}>
                      {v ? 'Yes' : 'No'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.rangeRow}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.rangeButton, selectedValue === v && { borderColor: colorHex, backgroundColor: colorHex }]}
                    onPress={() => setSelectedValue(v)}>
                    <Text style={[styles.rangeButtonText, selectedValue === v && styles.rangeButtonTextActive]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              style={[styles.saveButton, { backgroundColor: colorHex }, selectedValue === null && styles.saveButtonDisabled]}
              onPress={() => selectedValue !== null && handleSave(selectedValue)}
              disabled={selectedValue === null}>
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={styles.historyTitle}>History</Text>
      {trackerEntries.length === 0 ? (
        <Text style={styles.noEntries}>No entries yet. Add your first one above.</Text>
      ) : (
        <FlatList
          data={trackerEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.entryRow} onPress={() => setEditingEntry(item)}>
              <Text style={styles.entryDate}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.entryArrow}>→</Text>
              <Text style={[styles.entryValue, { color: colorHex }]}>
                {formatValue(item, tracker.type, isCount ? target : undefined)}
              </Text>
              <Text style={styles.entryChevron}>›</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.historyList}
          ListFooterComponent={hasMoreEntries ? (
            <AnimatedButton
              style={styles.loadMoreBtn}
              disabled={isLoadingMore}
              onPress={async () => {
                setIsLoadingMore(true);
                await loadMoreEntries();
                setIsLoadingMore(false);
              }}>
              <Text style={styles.loadMoreText}>
                {isLoadingMore ? 'Loading…' : 'Load older entries'}
              </Text>
            </AnimatedButton>
          ) : null}
        />
      )}

      {editingEntry && (
        <EditEntryDrawer
          tracker={tracker}
          entry={editingEntry}
          title={formatDate(editingEntry.createdAt)}
          onSave={async (value) => {
            await updateEntry(editingEntry.id, value);
            setEditingEntry(null);
          }}
          onDelete={async () => {
            await deleteEntry(editingEntry.id);
            setEditingEntry(null);
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </View>
  );
}

// ── Static styles (layout only, no colors) ─────────────────────────────────────

const countStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Space.base, paddingVertical: Space.md },
  ringWrapper: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  btn: {
    width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.popover,
  },
  btnText: { color: '#fff', fontSize: 28, fontWeight: Weight.bold },
  labelRow: { alignItems: 'center' },
  countNum: { fontSize: 28, fontWeight: '800' },
  countTarget: { fontSize: 20, fontWeight: Weight.medium },
});

const logStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Space.xl, paddingVertical: Space.base },
  totalWrapper: { alignItems: 'center', gap: Space.xs },
  checkmark: { fontSize: 20, fontWeight: Weight.bold },
  total: { fontSize: 56, fontWeight: '800', lineHeight: 64 },
  reference: { fontSize: 13, fontWeight: Weight.medium },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Space.base },
  input: {
    width: 130, paddingVertical: Space.base, paddingHorizontal: Space.lg,
    borderWidth: Border.emphasis, borderRadius: Radius.md,
    fontSize: 22, fontWeight: Weight.bold, textAlign: 'center',
  },
  confirmBtn: {
    width: 48, height: 48, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  confirmBtnText: { color: '#fff', fontSize: 20, fontWeight: Weight.bold },
  actionsRow: { flexDirection: 'row', gap: Space.base },
  addBtn: { paddingHorizontal: Space['2xl'], paddingVertical: Space.lg, borderRadius: Radius.md, borderWidth: Border.emphasis },
  addBtnText: { fontSize: 16, fontWeight: Weight.bold },
  doneBtn: { paddingHorizontal: Space['2xl'], paddingVertical: Space.lg, borderRadius: Radius.md },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: Weight.bold },
});
