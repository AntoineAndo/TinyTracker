import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';

import { FormValues, TrackerFormFields, makeFormStyles } from '@/components/tracker-form-fields';
import { useTrackers } from '@/context/trackers-context';
import { useTheme } from '@/hooks/use-theme';
import { TRACKER_COLORS } from '@/lib/tracker-colors';
import { extractEmoji } from '@/lib/tracker-icons';

export default function NewTrackerScreen() {
  const router = useRouter();
  const { addTracker } = useTrackers();
  const c = useTheme();
  const styles = makeFormStyles(c);

  const { control, handleSubmit, watch, setValue, formState: { isValid } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      type: 'boolean',
      target: 1,
      direction: 'up',
      min: '',
      max: '',
      color: 'blue',
      icon: '',
      reminderFrequency: 'daily',
      frequencyDays: 3,
      reminderEnabled: false,
      reminderDays: [0, 1, 2, 3, 4],
      reminderHour: 20,
      reminderMinute: 0,
      orientation: 'goal',
    },
    mode: 'onChange',
  });

  const [type, color, frequency, orientation, reminderEnabled, reminderHour, reminderMinute] = watch(
    ['type', 'color', 'reminderFrequency', 'orientation', 'reminderEnabled', 'reminderHour', 'reminderMinute'] as const,
  );

  async function onSubmit(data: FormValues) {
    const parsedMin = data.type === 'log' && data.min.trim() !== '' ? parseFloat(data.min) : undefined;
    const parsedMax = data.type === 'log' && data.max.trim() !== '' ? parseFloat(data.max) : undefined;
    await addTracker({
      name: data.name.trim(),
      type: data.type,
      target: data.type === 'count' ? data.target : undefined,
      direction: data.type === 'range' ? data.direction : undefined,
      min: !isNaN(parsedMin!) ? parsedMin : undefined,
      max: !isNaN(parsedMax!) ? parsedMax : undefined,
      color: data.color,
      icon: extractEmoji(data.icon) ?? '',
      reminderFrequency: data.reminderFrequency,
      frequencyDays: data.reminderFrequency === 'custom' ? data.frequencyDays : undefined,
      reminder: data.reminderEnabled ? {
        enabled: true,
        days: data.reminderDays,
        hour: data.reminderHour,
        minute: data.reminderMinute,
      } : undefined,
      orientation: data.orientation,
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TrackerFormFields
          control={control}
          setValue={setValue}
          type={type}
          color={color}
          frequency={frequency}
          orientation={orientation}
          reminderEnabled={reminderEnabled}
          reminderHour={reminderHour}
          reminderMinute={reminderMinute}
          c={c}
          styles={styles}
          namePlaceholder="e.g. Mood, Exercise, Sleep hours…"
          autoFocusName
        />
        <Pressable
          style={[styles.saveButton, { backgroundColor: TRACKER_COLORS[color].hex }, !isValid && styles.saveButtonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid}>
          <Text style={styles.saveButtonText}>Save Tracker</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
