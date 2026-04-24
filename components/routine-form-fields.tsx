// Shared form fields + styles for creating/editing a routine: name, tracker
// picker with per-routine target overrides, active days, time window, and
// a reminder toggle.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Control, Controller, UseFormSetValue } from 'react-hook-form';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Border, Radius, Space, Type, Weight } from '@/constants/tokens';
import { AppTheme } from '@/hooks/use-theme';
import { RoutineTracker, Tracker } from '@/lib/types';

export type RoutineFormValues = {
  name: string;
  /** Ordered list of selected trackers with optional per-routine targets */
  trackers: RoutineTracker[];
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  reminderEnabled: boolean;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function makeRoutineFormStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: Space.xl, gap: Space.section, paddingBottom: Space.screenTop },
    field: { gap: Space.md },
    label: { ...Type.fieldLabel, color: c.textSub },
    input: {
      borderWidth: Border.hairline, borderColor: c.border, borderRadius: Radius.md,
      paddingHorizontal: Space.lg, paddingVertical: Space.base,
      fontSize: 16, color: c.text, backgroundColor: c.surface,
    },
    dayRow: { flexDirection: 'row', gap: Space.sm },
    dayPill: {
      flex: 1, paddingVertical: 9, borderRadius: Radius.sm,
      alignItems: 'center', backgroundColor: c.segmentBg,
    },
    dayPillActive: { backgroundColor: c.segmentActiveBg },
    dayPillText: { ...Type.caption, color: c.textSub },
    dayPillTextActive: { color: c.text },
    timeButton: {
      borderWidth: Border.hairline, borderColor: c.border, borderRadius: Radius.md,
      paddingHorizontal: Space.lg, paddingVertical: Space.base,
      backgroundColor: c.surface,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    timeButtonText: { fontSize: 16, color: c.text },
    timeChevron: { fontSize: 14, color: c.textSub },
    timeRow: { flexDirection: 'row', gap: Space.base },
    timeField: { flex: 1, gap: Space.md },
    reminderToggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    reminderToggleLabel: { ...Type.bodyMd, color: c.text },
    trackerList: { gap: Space.md },
    trackerRow: {
      backgroundColor: c.cardAlt, borderRadius: Radius.md,
      paddingHorizontal: Space.lg, paddingTop: Space.base, paddingBottom: Space.base,
      gap: Space.md,
    },
    trackerRowSelected: { borderWidth: Border.strong, borderColor: c.tint },
    trackerMain: { flexDirection: 'row', alignItems: 'center', gap: Space.base },
    trackerName: { flex: 1, fontSize: 15, color: c.text },
    checkbox: {
      width: 22, height: 22, borderRadius: 6,
      borderWidth: Border.strong, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: c.tint, borderColor: c.tint },
    checkmark: { color: '#fff', fontSize: 13, fontWeight: Weight.bold },
    // Routine target stepper (shown for selected count trackers)
    targetRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: Space.xs, gap: Space.md,
    },
    targetLabel: { fontSize: 12, color: c.textSub, flex: 1 },
    targetStepper: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
    targetBtn: {
      width: 28, height: 28, borderRadius: Radius.sm,
      borderWidth: Border.strong, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    targetBtnText: { fontSize: 16, color: c.text, lineHeight: 20 },
    targetValue: { fontSize: 15, fontWeight: Weight.semibold, color: c.text, minWidth: 28, textAlign: 'center' },
    targetFraction: { fontSize: 12, color: c.textSub },
    emptyTrackers: { fontSize: 14, color: c.textSub, fontStyle: 'italic', textAlign: 'center', paddingVertical: Space.md },
    saveButton: { borderRadius: Radius.md, paddingVertical: Space.lg, alignItems: 'center', marginTop: Space.md },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: Weight.semibold },
    deleteButton: {
      borderRadius: Radius.md, paddingVertical: Space.lg, alignItems: 'center',
      borderWidth: Border.strong, borderColor: '#ef4444',
    },
    deleteButtonText: { color: '#ef4444', fontSize: 16, fontWeight: Weight.semibold },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 2 },
  });
}

type Styles = ReturnType<typeof makeRoutineFormStyles>;

export function RoutineFormFields({ control, setValue, trackers, startHour, startMinute, endHour, endMinute, reminderEnabled, c, styles }: {
  control: Control<RoutineFormValues>;
  setValue: UseFormSetValue<RoutineFormValues>;
  trackers: Tracker[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  reminderEnabled: boolean;
  c: AppTheme;
  styles: Styles;
}) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  return (
    <>
      {/* Name */}
      <Controller
        control={control}
        name="name"
        rules={{ validate: (v) => !!v.trim() || 'Name is required' }}
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning Routine"
              placeholderTextColor={c.textMuted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoFocus
              returnKeyType="done"
            />
            {error && <Text style={styles.errorText}>{error.message}</Text>}
          </View>
        )}
      />

      {/* Trackers */}
      <Controller
        control={control}
        name="trackers"
        rules={{ validate: (v) => v.length > 0 || 'Select at least one tracker' }}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Trackers</Text>
            {trackers.length === 0 ? (
              <Text style={styles.emptyTrackers}>No trackers yet. Create some trackers first.</Text>
            ) : (
              <View style={styles.trackerList}>
                {trackers.map((tracker) => {
                  const existing = value.find((rt) => rt.id === tracker.id);
                  const selected = !!existing;
                  const isCount = tracker.type === 'count';
                  const fullTarget = tracker.target ?? 1;
                  const routineTarget = existing?.routineTarget ?? fullTarget;

                  function toggle() {
                    onChange(
                      selected
                        ? value.filter((rt) => rt.id !== tracker.id)
                        : [...value, { id: tracker.id }],
                    );
                  }

                  function setTarget(delta: number) {
                    const next = Math.min(fullTarget, Math.max(1, routineTarget + delta));
                    onChange(
                      value.map((rt) =>
                        rt.id === tracker.id
                          ? { ...rt, routineTarget: next === fullTarget ? undefined : next }
                          : rt,
                      ),
                    );
                  }

                  return (
                    <View key={tracker.id} style={[styles.trackerRow, selected && styles.trackerRowSelected]}>
                      <Pressable style={styles.trackerMain} onPress={toggle}>
                        <Text style={styles.trackerName}>{tracker.icon ? `${tracker.icon} ` : ''}{tracker.name}</Text>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      </Pressable>

                      {/* Routine target stepper — only for selected count trackers with target > 1 */}
                      {selected && isCount && fullTarget > 1 && (
                        <View style={styles.targetRow}>
                          <Text style={styles.targetLabel}>Routine target</Text>
                          <View style={styles.targetStepper}>
                            <Pressable style={styles.targetBtn} onPress={() => setTarget(-1)}>
                              <Text style={styles.targetBtnText}>−</Text>
                            </Pressable>
                            <Text style={styles.targetValue}>{routineTarget}</Text>
                            <Pressable style={styles.targetBtn} onPress={() => setTarget(+1)}>
                              <Text style={styles.targetBtnText}>+</Text>
                            </Pressable>
                            <Text style={styles.targetFraction}>/ {fullTarget}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {error && <Text style={styles.errorText}>{error.message}</Text>}
          </View>
        )}
      />

      {/* Days */}
      <Controller
        control={control}
        name="days"
        rules={{ validate: (v) => v.length > 0 || 'Select at least one day' }}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Active Days</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, i) => {
                const active = value.includes(i);
                return (
                  <Pressable
                    key={i}
                    style={[styles.dayPill, active && styles.dayPillActive]}
                    onPress={() =>
                      onChange(active ? value.filter((d) => d !== i) : [...value, i].sort((a, b) => a - b))
                    }
                  >
                    <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
          </View>
        )}
      />

      {/* Time window */}
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.label}>Start Time</Text>
          <Pressable style={styles.timeButton} onPress={() => { setShowStartPicker((v) => !v); setShowEndPicker(false); }}>
            <Text style={styles.timeButtonText}>{formatTime(startHour, startMinute)}</Text>
            <Text style={styles.timeChevron}>{showStartPicker ? '▲' : '▼'}</Text>
          </Pressable>
          {showStartPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, startHour, startMinute)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, date) => {
                if (Platform.OS === 'android') setShowStartPicker(false);
                if (date) {
                  setValue('startHour', date.getHours(), { shouldDirty: true });
                  setValue('startMinute', date.getMinutes(), { shouldDirty: true });
                }
              }}
            />
          )}
        </View>
        <View style={styles.timeField}>
          <Text style={styles.label}>End Time</Text>
          <Pressable style={styles.timeButton} onPress={() => { setShowEndPicker((v) => !v); setShowStartPicker(false); }}>
            <Text style={styles.timeButtonText}>{formatTime(endHour, endMinute)}</Text>
            <Text style={styles.timeChevron}>{showEndPicker ? '▲' : '▼'}</Text>
          </Pressable>
          {showEndPicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, endHour, endMinute)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, date) => {
                if (Platform.OS === 'android') setShowEndPicker(false);
                if (date) {
                  setValue('endHour', date.getHours(), { shouldDirty: true });
                  setValue('endMinute', date.getMinutes(), { shouldDirty: true });
                }
              }}
            />
          )}
        </View>
      </View>

      {/* Reminder toggle */}
      <Controller
        control={control}
        name="reminderEnabled"
        render={({ field: { value, onChange } }) => (
          <View style={styles.reminderToggleRow}>
            <Text style={styles.reminderToggleLabel}>Remind me 30 min before end</Text>
            <Switch value={value} onValueChange={onChange} ios_backgroundColor={c.segmentBg} />
          </View>
        )}
      />
    </>
  );
}
