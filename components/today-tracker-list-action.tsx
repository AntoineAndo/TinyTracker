import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AnimatedButton } from '@/components/animated-button';
import { useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { Entry, Tracker } from '@/lib/types';
import { toNumericValue } from '@/lib/utils';

import type { TodayTrackerListStyles } from './today-tracker-list-styles';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isCompleted(tracker: Tracker, entry: Entry | undefined): boolean {
  if (!entry) return false;
  if (tracker.type === 'log') return entry.completed === true;
  const val = toNumericValue(entry.value);
  // Neutral boolean: any logged answer (Yes or No) counts as completed for the day.
  if (tracker.type === 'boolean') return tracker.orientation === 'neutral' ? true : val === 1;
  if (tracker.type === 'count') return val >= (tracker.target ?? 1);
  // Range trackers are considered completed as soon as any value is saved.
  return true;
}

export function wouldComplete(tracker: Tracker, value: number): boolean {
  if (tracker.type === 'log') return false;
  // Neutral boolean: both Yes (1) and No (0) complete the tracker.
  if (tracker.type === 'boolean') return tracker.orientation === 'neutral' ? true : value === 1;
  if (tracker.type === 'count') return value >= (tracker.target ?? 1);
  // Range trackers complete on any value selection.
  return true;
}

// ── CompletedValue ────────────────────────────────────────────────────────────

/** Displays the recorded value for a tracker that has already been completed today. */
export function CompletedValue({ tracker, entry, styles }: {
  tracker: Tracker;
  entry: Entry;
  styles: TodayTrackerListStyles;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const val = toNumericValue(entry.value);

  let label = '';
  if (tracker.type === 'boolean') {
    // Neutral boolean: show the actual answer recorded (Yes/No).
    // Goal boolean: always shows "Done" since there's only one positive state.
    label = tracker.orientation === 'neutral' ? (val === 1 ? 'Yes' : 'No') : 'Done';
  } else if (tracker.type === 'count') {
    label = `${val} / ${tracker.target ?? 1}`;
  } else {
    // log and range: display the raw numeric value.
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

/**
 * Action widget for 'log' trackers.
 * The user taps "+ Add" to open an inline input and accumulate a running total,
 * then taps "Done" to explicitly close the tracker for the day.
 */
function LogQuickAction({ tracker, entry, onSave, onComplete, styles }: {
  tracker: Tracker;
  entry: Entry | undefined;
  onSave: (amount: number) => void;
  onComplete: () => void;
  styles: TodayTrackerListStyles;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const currentTotal = entry ? (entry.value as number) : 0;
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const c = useTheme();

  function confirmAdd() {
    const amount = parseFloat(inputVal);
    if (!isNaN(amount) && amount > 0) onSave(amount);
    setInputVal('');
    setAdding(false);
  }

  // Inline input mode: shown while the user is entering a value to add.
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
      {/* Running total — hidden until the first value is added to avoid visual clutter. */}
      {currentTotal > 0 && (
        <Text style={styles.logTotal}>{currentTotal}</Text>
      )}
      <AnimatedButton
        style={[styles.logAddBtn, { borderColor: colorHex }]}
        onPress={() => setAdding(true)}>
        <Text style={[styles.logAddBtnText, { color: colorHex }]}>+ Add</Text>
      </AnimatedButton>
      {/* "Done" closes the tracker for the day; separate from adding values
          so the user can log multiple increments before marking it complete. */}
      <Pressable style={[styles.logDoneBtn, { backgroundColor: colorHex }]} onPress={onComplete}>
        <Text style={styles.logDoneBtnText}>Done</Text>
      </Pressable>
    </View>
  );
}

// ── QuickAction ───────────────────────────────────────────────────────────────

/**
 * The primary action widget rendered in each tracker row before the entry is logged.
 * Delegates to a type-specific layout for each tracker type.
 */
export function QuickAction({ tracker, entry, onSave, onComplete, styles }: {
  tracker: Tracker;
  entry: Entry | undefined;
  onSave: (value: number) => void;
  onComplete: () => void;
  styles: TodayTrackerListStyles;
}) {
  const colorHex = getTrackerColorHex(tracker.color);
  const target = tracker.target ?? 1;
  const currentVal = entry ? toNumericValue(entry.value) : 0;

  // Log trackers have their own compound widget (running total + inline input + Done).
  if (tracker.type === 'log') {
    return <LogQuickAction tracker={tracker} entry={entry} onSave={onSave} onComplete={onComplete} styles={styles} />;
  }

  if (tracker.type === 'boolean') {
    // Neutral boolean: two-button Yes / No toggle.
    // "No" only highlights when an entry already exists with value 0,
    // preventing the button from appearing pre-selected before the user logs anything.
    if (tracker.orientation === 'neutral') {
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

    // Goal boolean: single "Done" button — only one meaningful state to record.
    return (
      <Pressable
        style={[styles.boolBtn, { borderColor: colorHex }, currentVal === 1 && { backgroundColor: colorHex }]}
        onPress={() => onSave(1)}>
        <Text style={[styles.boolBtnText, currentVal === 1 && styles.boolBtnTextActive]}>Done</Text>
      </Pressable>
    );
  }

  if (tracker.type === 'count') {
    // Count tracker: shows progress toward the target and a +1 button.
    // Capped at target so the user can't over-log.
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

  // Range tracker: 1–5 segmented buttons; tapping the active value again is a no-op.
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
