// Quick-action controls rendered on the right side of each tracker row.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AnimatedButton } from '@/components/animated-button';
import { Border, Radius, Size, Space, Weight } from '@/constants/tokens';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { isCheckboxControl, isCompleted, wouldComplete } from '@/lib/tracker-utils';
import { Entry, Tracker } from '@/lib/types';
import { toNumericValue } from '@/lib/utils';

export { isCompleted, wouldComplete };

// Checkbox dimensions shared between the style and the SVG icon. The icon is
// ~half the container so the tap target stays generous around a compact glyph.
const CHECKBOX_ICON_SIZE = 18;

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    boolBtn: { paddingHorizontal: Space.lg, paddingVertical: Space.sm, borderRadius: Radius.md, borderWidth: Border.strong, borderColor: c.border },
    boolBtnText: { fontSize: 14, fontWeight: Weight.semibold, color: c.textSub },
    boolBtnTextActive: { color: '#fff' },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: Space.base },
    countProgress: { fontSize: 14, fontWeight: Weight.semibold, color: c.textSub },
    countBtn: { paddingHorizontal: Space.lg, paddingVertical: Space.sm, borderRadius: Radius.md },
    countBtnText: { fontSize: 14, fontWeight: Weight.bold, color: '#fff' },
    rangeRow: { flexDirection: 'row', gap: Space.xs },
    rangeBtn: { width: Size.iconBgSm, height: Size.iconBgSm, borderRadius: Radius.sm, borderWidth: Border.strong, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    rangeBtnText: { fontSize: 13, fontWeight: Weight.semibold, color: c.textSub },
    rangeBtnTextActive: { color: '#fff' },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    logTotal: { fontSize: 14, fontWeight: Weight.semibold, color: c.textSub, minWidth: 36, textAlign: 'right' },
    logAddBtn: { paddingHorizontal: Space.base, paddingVertical: Space.sm, borderRadius: Radius.md, borderWidth: Border.strong },
    logAddBtnText: { fontSize: 14, fontWeight: Weight.semibold },
    logDoneBtn: { paddingHorizontal: Space.base, paddingVertical: Space.sm, borderRadius: Radius.md },
    logDoneBtnText: { fontSize: 14, fontWeight: Weight.bold, color: '#fff' },
    logInputRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    logInput: {
      width: 80, paddingVertical: Space.sm, paddingHorizontal: Space.base,
      borderWidth: Border.strong, borderRadius: Radius.md,
      fontSize: 14, textAlign: 'right',
      color: c.text, backgroundColor: c.surface,
    },
    logConfirmBtn: { width: Size.checkbox, height: Size.checkbox, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    logConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: Weight.bold },
    completedValue: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
    completedCheck: { fontSize: 15, fontWeight: Weight.bold },
    completedLabel: { fontSize: 15, fontWeight: Weight.semibold },
    checkboxBtn: {
      width: Size.checkbox, height: Size.checkbox, borderRadius: Radius.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxIdle: { borderWidth: Border.strong, borderColor: c.border },
  });
}

// ── CheckboxControl ───────────────────────────────────────────────────────────

// Shared checkbox shape used for boolean-goal and count-target-1 trackers.
function CheckboxControl({ checked, colorHex, onPress }: { checked: boolean; colorHex: string; onPress: () => void }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      style={[styles.checkboxBtn, checked ? { backgroundColor: colorHex } : styles.checkboxIdle]}
      onPress={onPress}
    >
      {checked && (
        <Svg width={CHECKBOX_ICON_SIZE} height={CHECKBOX_ICON_SIZE} viewBox="0 0 18 18" fill="none">
          <Path d="M3.5 9.5L7.5 13L14.5 5.5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </Pressable>
  );
}

// ── CompletedValue ────────────────────────────────────────────────────────────

export function CompletedValue({ tracker, entry, routineTarget }: { tracker: Tracker; entry: Entry; routineTarget?: number }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const colorHex = getTrackerColorHex(tracker.color);
  const val = toNumericValue(entry.value);

  let label = '';
  if (tracker.type === 'boolean') {
    label = tracker.orientation === 'neutral' ? (val === 1 ? 'Yes' : 'No') : 'Done';
  } else if (tracker.type === 'count') {
    // Checkbox-shaped count trackers (target === 1) never reach here — TrackerEntryRow
    // keeps QuickAction mounted for them so the checked checkbox is their done state.
    label = `${val} / ${routineTarget ?? tracker.target ?? 1}`;
  } else {
    label = String(val);
  }

  return (
    <View style={styles.completedValue}>
      <Text style={[styles.completedCheck, { color: colorHex }]}>✓</Text>
      <Text style={[styles.completedLabel, { color: colorHex }]}>{label}</Text>
    </View>
  );
}

// ── LogQuickAction ────────────────────────────────────────────────────────────

function LogQuickAction({ tracker, entry, onSave, onComplete }: {
  tracker: Tracker;
  entry: Entry | undefined;
  onSave: (amount: number) => void;
  onComplete: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const colorHex = getTrackerColorHex(tracker.color);
  const currentTotal = entry ? (entry.value as number) : 0;
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');

  function confirmAdd() {
    const amount = parseFloat(inputVal);
    if (!isNaN(amount) && amount > 0) onSave(amount);
    setInputVal('');
    setAdding(false);
  }

  if (adding) {
    return (
      <View style={styles.logInputRow}>
        <TextInput
          style={[styles.logInput, { borderColor: colorHex }]}
          value={inputVal}
          onChangeText={setInputVal}
          keyboardType="decimal-pad"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={confirmAdd}
          placeholder="0"
          placeholderTextColor={c.textMuted}
        />
        <Pressable style={[styles.logConfirmBtn, { backgroundColor: colorHex }]} onPress={confirmAdd}>
          <Text style={styles.logConfirmBtnText}>✓</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.logRow}>
      {currentTotal > 0 && <Text style={styles.logTotal}>{currentTotal}</Text>}
      <AnimatedButton
        style={[styles.logAddBtn, { borderColor: colorHex }]}
        onPress={() => setAdding(true)}>
        <Text style={[styles.logAddBtnText, { color: colorHex }]}>+ Add</Text>
      </AnimatedButton>
      <Pressable style={[styles.logDoneBtn, { backgroundColor: colorHex }]} onPress={onComplete}>
        <Text style={styles.logDoneBtnText}>Done</Text>
      </Pressable>
    </View>
  );
}

// ── QuickAction ───────────────────────────────────────────────────────────────

export function QuickAction({ tracker, entry, onSave, onComplete, routineTarget }: {
  tracker: Tracker;
  entry: Entry | undefined;
  onSave: (value: number) => void;
  onComplete: () => void;
  routineTarget?: number;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const colorHex = getTrackerColorHex(tracker.color);
  const target = routineTarget ?? tracker.target ?? 1;
  const currentVal = entry ? toNumericValue(entry.value) : 0;

  if (tracker.type === 'log') {
    return <LogQuickAction tracker={tracker} entry={entry} onSave={onSave} onComplete={onComplete} />;
  }

  // Checkbox shape: boolean-goal trackers and count trackers with target === 1.
  if (isCheckboxControl(tracker, routineTarget)) {
    return <CheckboxControl checked={currentVal >= 1} colorHex={colorHex} onPress={() => onSave(1)} />;
  }

  // Neutral boolean — two pill buttons for Yes / No.
  if (tracker.type === 'boolean') {
    return (
      <View style={styles.countRow}>
        <Pressable
          style={[styles.boolBtn, { borderColor: colorHex }, currentVal === 1 && { backgroundColor: colorHex }]}
          onPress={() => onSave(1)}>
          <Text style={[styles.boolBtnText, currentVal === 1 && styles.boolBtnTextActive]}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.boolBtn, { borderColor: colorHex }, currentVal === 0 && entry && { backgroundColor: colorHex }]}
          onPress={() => onSave(0)}>
          <Text style={[styles.boolBtnText, currentVal === 0 && entry && styles.boolBtnTextActive]}>No</Text>
        </Pressable>
      </View>
    );
  }

  // Count tracker with target > 1 — progress label + increment button.
  if (tracker.type === 'count') {
    return (
      <View style={styles.countRow}>
        <Text style={styles.countProgress}>{currentVal}/{target}</Text>
        <AnimatedButton
          style={[styles.countBtn, { backgroundColor: colorHex }]}
          onPress={() => onSave(Math.min(currentVal + 1, target))}>
          <Text style={styles.countBtnText}>+1</Text>
        </AnimatedButton>
      </View>
    );
  }

  // Range tracker — 1–5 pill buttons.
  return (
    <View style={styles.rangeRow}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Pressable
          key={v}
          style={[styles.rangeBtn, { borderColor: colorHex }, currentVal === v && { backgroundColor: colorHex }]}
          onPress={() => onSave(v)}>
          <Text style={[styles.rangeBtnText, currentVal === v && styles.rangeBtnTextActive]}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}
