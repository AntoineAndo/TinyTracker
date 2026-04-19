import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Control, Controller, UseFormSetValue } from 'react-hook-form';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SegmentControl } from '@/components/segment-control';
import { AppTheme } from '@/hooks/use-theme';
import { TRACKER_COLOR_ORDER, TRACKER_COLORS } from '@/lib/tracker-colors';
import { extractEmoji } from '@/lib/tracker-icons';
import { ReminderFrequency, TrackerColor, TrackerType } from '@/lib/types';

export type FormValues = {
  name: string;
  type: TrackerType;
  target: number;
  direction: 'up' | 'down';
  min: string;
  max: string;
  color: TrackerColor;
  icon: string;
  reminderFrequency: ReminderFrequency;
  frequencyDays: number;
  reminderEnabled: boolean;
  reminderDays: number[];
  reminderHour: number;
  reminderMinute: number;
  orientation: 'goal' | 'neutral';
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function makeFormStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 24 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: 16, color: c.textSub },
    field: { gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
    hint: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 16, color: c.text, backgroundColor: c.surface,
    },
    segment: { flexDirection: 'row', backgroundColor: c.segmentBg, borderRadius: 10, padding: 3, gap: 3 },
    segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentItemActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000', shadowOpacity: c.segmentActiveShadowOpacity,
      shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    segmentText: { fontSize: 14, color: c.textSub, fontWeight: '500' },
    segmentTextActive: { color: c.text, fontWeight: '600' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 24, color: c.text, lineHeight: 30 },
    stepValue: { fontSize: 24, fontWeight: '700', color: c.text, minWidth: 36, textAlign: 'center' },
    minMaxRow: { flexDirection: 'row', gap: 16 },
    minMaxField: { flex: 1, gap: 8 },
    colorRow: { flexDirection: 'row', gap: 12 },
    colorDot: { width: 36, height: 36, borderRadius: 18 },
    colorDotSelected: { borderWidth: 3, borderColor: c.text },
    iconRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconInput: {
      width: 56, height: 56, borderRadius: 12, borderWidth: 2,
      backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center',
    },
    iconEmoji: { fontSize: 28, textAlign: 'center', width: 52, lineHeight: 36, paddingVertical: 0, includeFontPadding: false },
    clearButton: {
      position: 'absolute', top: -8, right: -8,
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: c.textSub, alignItems: 'center', justifyContent: 'center',
    },
    clearButtonText: { color: c.background, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    iconHint: { flex: 1, fontSize: 13, color: c.textSub, lineHeight: 18 },
    saveButton: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    deleteButton: {
      borderRadius: 12, paddingVertical: 15, alignItems: 'center',
      borderWidth: 1.5, borderColor: '#ef4444',
    },
    deleteButtonText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
    // Reminder styles
    reminderToggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    reminderToggleLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayPill: {
      flex: 1, paddingVertical: 9, borderRadius: 8,
      alignItems: 'center', backgroundColor: c.segmentBg,
    },
    dayPillActive: { backgroundColor: c.segmentActiveBg },
    dayPillText: { fontSize: 12, fontWeight: '600', color: c.textSub },
    dayPillTextActive: { color: c.text },
    timeButton: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: c.surface,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    timeButtonText: { fontSize: 16, color: c.text },
    timeChevron: { fontSize: 14, color: c.textSub },
  });
}

type Styles = ReturnType<typeof makeFormStyles>;

export function TrackerFormFields({ control, setValue, type, color, frequency, orientation, reminderEnabled, reminderHour, reminderMinute, c, styles, namePlaceholder, autoFocusName = false }: {
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  type: TrackerType;
  frequency: ReminderFrequency;
  color: TrackerColor;
  orientation: 'goal' | 'neutral';
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  c: AppTheme;
  styles: Styles;
  namePlaceholder?: string;
  autoFocusName?: boolean;
}) {
  const [showTimePicker, setShowTimePicker] = useState(false);

  return (
    <>
      <Controller
        control={control}
        name="name"
        rules={{ validate: (v) => !!v.trim() }}
        render={({ field: { value, onChange, onBlur } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder={namePlaceholder}
              placeholderTextColor={c.textMuted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoFocus={autoFocusName}
              returnKeyType="done"
            />
            {namePlaceholder && <Text style={styles.hint}>{orientation === 'neutral' ? 'Describe what you want to observe' : 'Frame it as something you want to do more of'}</Text>}
          </View>
        )}
      />

      <Controller
        control={control}
        name="type"
        render={({ field: { value, onChange } }) => (
          <SegmentControl
            label="Type"
            value={value}
            onChange={onChange}
            options={[
              { value: 'boolean', label: 'Yes / No' },
              { value: 'count', label: 'Count' },
              { value: 'range', label: '1 – 5 range' },
              { value: 'log', label: 'Number' },
            ]}
          />
        )}
      />

      {type === 'count' && (
        <Controller
          control={control}
          name="target"
          render={({ field: { value, onChange } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>Daily Target</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(1, value - 1))}>
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{value}</Text>
                <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {type === 'range' && (
        <Controller
          control={control}
          name="direction"
          render={({ field: { value, onChange } }) => (
            <SegmentControl
              label="Direction"
              value={value}
              onChange={onChange}
              options={[
                { value: 'up', label: '↑ Higher is better' },
                { value: 'down', label: '↓ Lower is better' },
              ]}
            />
          )}
        />
      )}

      {type === 'log' && (
        <View style={styles.minMaxRow}>
          <Controller
            control={control}
            name="min"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.minMaxField}>
                <Text style={styles.label}>Min (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1500"
                  placeholderTextColor={c.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name="max"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.minMaxField}>
                <Text style={styles.label}>Max (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2000"
                  placeholderTextColor={c.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            )}
          />
        </View>
      )}

      {(type === 'boolean' || type === 'count') && (
        <Controller
          control={control}
          name="orientation"
          render={({ field: { value, onChange } }) => (
            <SegmentControl
              label="Orientation"
              value={value}
              onChange={onChange}
              options={[
                { value: 'goal', label: '🎯 Goal' },
                { value: 'neutral', label: '📋 Neutral' },
              ]}
            />
          )}
        />
      )}

      <Controller
        control={control}
        name="color"
        render={({ field: { value, onChange } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {TRACKER_COLOR_ORDER.map((col) => (
                <Pressable
                  key={col}
                  style={[styles.colorDot, { backgroundColor: TRACKER_COLORS[col].hex }, value === col && styles.colorDotSelected]}
                  onPress={() => onChange(col)}
                />
              ))}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field: { value, onChange, onBlur } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconRow}>
              <View style={[styles.iconInput, { borderColor: extractEmoji(value) ? TRACKER_COLORS[color].hex : c.border }]}>
                <TextInput
                  style={styles.iconEmoji}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={2}
                  textAlign="center"
                />
                {!!value && (
                  <Pressable style={styles.clearButton} onPress={() => onChange('')} hitSlop={8}>
                    <Text style={styles.clearButtonText}>×</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.iconHint}>Switch to your emoji keyboard and tap any emoji</Text>
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="reminderFrequency"
        render={({ field: { value, onChange } }) => (
          <SegmentControl
            label="Frequency"
            value={value}
            onChange={onChange}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        )}
      />

      {frequency === 'custom' && (
        <Controller
          control={control}
          name="frequencyDays"
          render={({ field: { value, onChange } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>Every N days</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(2, value - 1))}>
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{value}</Text>
                <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Reminders ─────────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name="reminderEnabled"
        render={({ field: { value, onChange } }) => (
          <View style={styles.reminderToggleRow}>
            <Text style={styles.reminderToggleLabel}>Reminders</Text>
            <Switch
              value={value}
              onValueChange={onChange}
              ios_backgroundColor={c.segmentBg}
            />
          </View>
        )}
      />

      {reminderEnabled && (
        <>
          <Controller
            control={control}
            name="reminderDays"
            render={({ field: { value, onChange } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>Days</Text>
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
                        <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Time</Text>
            <Pressable
              style={styles.timeButton}
              onPress={() => setShowTimePicker((v) => !v)}
            >
              <Text style={styles.timeButtonText}>{formatTime(reminderHour, reminderMinute)}</Text>
              <Text style={styles.timeChevron}>{showTimePicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={new Date(2000, 0, 1, reminderHour, reminderMinute)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event, date) => {
                  if (Platform.OS === 'android') setShowTimePicker(false);
                  if (date) {
                    setValue('reminderHour', date.getHours(), { shouldDirty: true });
                    setValue('reminderMinute', date.getMinutes(), { shouldDirty: true });
                  }
                }}
              />
            )}
          </View>
        </>
      )}
    </>
  );
}
