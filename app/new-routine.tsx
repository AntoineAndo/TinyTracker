import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';

import { RoutineFormFields, RoutineFormValues, makeRoutineFormStyles } from '@/components/routine-form-fields';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { useTheme } from '@/hooks/use-theme';

export default function NewRoutineScreen() {
  const router = useRouter();
  const { addRoutine } = useRoutines();
  const { trackers } = useTrackers();
  const c = useTheme();
  const styles = useMemo(() => makeRoutineFormStyles(c), [c]);

  const { control, handleSubmit, watch, setValue, formState: { isValid } } = useForm<RoutineFormValues>({
    defaultValues: {
      name: '',
      trackers: [],
      days: [0, 1, 2, 3, 4],
      startHour: 7,
      startMinute: 0,
      endHour: 9,
      endMinute: 0,
      reminderEnabled: false,
    },
    mode: 'onChange',
  });

  const [startHour, startMinute, endHour, endMinute, reminderEnabled] = watch(
    ['startHour', 'startMinute', 'endHour', 'endMinute', 'reminderEnabled'] as const,
  );

  async function onSubmit(data: RoutineFormValues) {
    await addRoutine({
      name: data.name.trim(),
      trackers: data.trackers,
      days: data.days,
      startHour: data.startHour,
      startMinute: data.startMinute,
      endHour: data.endHour,
      endMinute: data.endMinute,
      reminderEnabled: data.reminderEnabled,
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RoutineFormFields
          control={control}
          setValue={setValue}
          trackers={trackers}
          startHour={startHour}
          startMinute={startMinute}
          endHour={endHour}
          endMinute={endMinute}
          reminderEnabled={reminderEnabled}
          c={c}
          styles={styles}
        />
        <Pressable
          style={[styles.saveButton, { backgroundColor: c.tint }, !isValid && styles.saveButtonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid}>
          <Text style={styles.saveButtonText}>Save Routine</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
