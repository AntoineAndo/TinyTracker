import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoutineFormFields, RoutineFormValues, makeRoutineFormStyles } from '@/components/routine-form-fields';
import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { useTheme } from '@/hooks/use-theme';

export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { routines, updateRoutine, deleteRoutine } = useRoutines();
  const { trackers } = useTrackers();
  const c = useTheme();
  const styles = useMemo(() => makeRoutineFormStyles(c), [c]);

  const routine = routines.find((r) => r.id === id);

  const { control, handleSubmit, watch, setValue, formState: { isValid } } = useForm<RoutineFormValues>({
    defaultValues: {
      name: routine?.name ?? '',
      trackers: routine?.trackers ?? [],
      days: routine?.days ?? [0, 1, 2, 3, 4],
      startHour: routine?.startHour ?? 7,
      startMinute: routine?.startMinute ?? 0,
      endHour: routine?.endHour ?? 9,
      endMinute: routine?.endMinute ?? 0,
      reminderEnabled: routine?.reminderEnabled ?? false,
    },
    mode: 'onChange',
  });

  const [startHour, startMinute, endHour, endMinute, reminderEnabled] = watch(
    ['startHour', 'startMinute', 'endHour', 'endMinute', 'reminderEnabled'] as const,
  );

  if (!routine) {
    return (
      <View style={localStyles.centered}>
        <Text style={{ color: c.textSub }}>Routine not found.</Text>
      </View>
    );
  }

  async function onSubmit(data: RoutineFormValues) {
    await updateRoutine(id, {
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

  function confirmDelete() {
    Alert.alert(
      'Delete Routine',
      `Delete "${routine!.name}"? This won't affect your trackers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRoutine(id);
            router.dismissAll();
          },
        },
      ],
    );
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
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteButtonText}>Delete Routine</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
