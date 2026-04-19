import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { FormValues, TrackerFormFields, makeFormStyles } from '@/components/tracker-form-fields';
import { useTrackers } from '@/context/trackers-context';
import { useTheme } from '@/hooks/use-theme';
import { TRACKER_COLORS } from '@/lib/tracker-colors';
import { extractEmoji, resolveIcon } from '@/lib/tracker-icons';

export default function EditTrackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { trackers, updateTracker, deleteTracker } = useTrackers();
  const c = useTheme();
  const styles = makeFormStyles(c);

  const tracker = trackers.find((t) => t.id === id);

  const { control, handleSubmit, watch, setValue, formState: { isValid } } = useForm<FormValues>({
    defaultValues: {
      name: tracker?.name ?? '',
      type: tracker?.type ?? 'boolean',
      target: tracker?.target ?? 1,
      direction: tracker?.direction ?? 'up',
      min: tracker?.min !== undefined ? String(tracker.min) : '',
      max: tracker?.max !== undefined ? String(tracker.max) : '',
      color: tracker?.color ?? 'blue',
      icon: resolveIcon(tracker?.icon),
      reminderFrequency: tracker?.reminderFrequency ?? 'daily',
      frequencyDays: tracker?.frequencyDays ?? 3,
      reminderEnabled: tracker?.reminder?.enabled ?? false,
      reminderDays: tracker?.reminder?.days ?? [0, 1, 2, 3, 4],
      reminderHour: tracker?.reminder?.hour ?? 20,
      reminderMinute: tracker?.reminder?.minute ?? 0,
      orientation: tracker?.orientation ?? 'goal',
    },
    mode: 'onChange',
  });

  const [type, color, frequency, orientation, reminderEnabled, reminderHour, reminderMinute] = watch(
    ['type', 'color', 'reminderFrequency', 'orientation', 'reminderEnabled', 'reminderHour', 'reminderMinute'] as const,
  );

  if (!tracker) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Tracker not found.</Text>
      </View>
    );
  }

  async function onSubmit(data: FormValues) {
    const parsedMin = data.type === 'log' && data.min.trim() !== '' ? parseFloat(data.min) : undefined;
    const parsedMax = data.type === 'log' && data.max.trim() !== '' ? parseFloat(data.max) : undefined;
    await updateTracker(id, {
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

  function confirmDelete() {
    Alert.alert(
      'Delete Tracker',
      `Delete "${tracker!.name}" and all its entries? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTracker(id);
            router.dismissAll();
          },
        },
      ]
    );
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
        />
        <Pressable
          style={[styles.saveButton, { backgroundColor: TRACKER_COLORS[color].hex }, !isValid && styles.saveButtonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteButtonText}>Delete Tracker</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
