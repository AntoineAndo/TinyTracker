import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/animated-button';
import { AnimationSetting, ThemeSetting, useSettings } from '@/context/settings-context';
import { sendTestNotification } from '@/hooks/use-notification-scheduler';
import { AppTheme, useTheme } from '@/hooks/use-theme';

const ANIMATION_OPTIONS: { value: AnimationSetting; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'Animations are always disabled' },
  { value: 'system', label: 'System', description: 'Follow the device accessibility setting' },
  { value: 'on', label: 'On', description: 'Animations are always enabled' },
];

const THEME_OPTIONS: { value: ThemeSetting; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme' },
  { value: 'system', label: 'System', description: 'Follow the device appearance setting' },
  { value: 'light', label: 'Light', description: 'Always use the light theme' },
];

const DAY_START_MIN = -12;
const DAY_START_MAX = 11;


function formatHour(h: number): string {
  if (h === 0) return 'Midnight';
  if (h === 12) return '12:00 PM';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

function formatDayStartHour(h: number): string {
  if (h === 0) return 'Midnight';
  // Convert offset to a real clock hour (0–23)
  const hour = ((h % 24) + 24) % 24;
  if (hour === 0) return 'Midnight';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    section: { marginTop: 32, paddingHorizontal: 20, gap: 10 },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: c.textSub,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginBottom: 2,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    settingLabel: { fontSize: 16, fontWeight: '600', color: c.text },
    settingDescription: { fontSize: 14, color: c.textSub, lineHeight: 20 },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.segmentBg,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segment: {
      flex: 1, paddingVertical: 8,
      borderRadius: 8, alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000',
      shadowOpacity: c.segmentActiveShadowOpacity,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentText: { fontSize: 14, fontWeight: '600', color: c.textSub },
    segmentTextActive: { color: c.text },
    optionDescription: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepBtn: {
      width: 36, height: 36, borderRadius: 8,
      borderWidth: 1.5, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBtnText: { fontSize: 22, color: c.text, lineHeight: 26 },
    stepValue: { fontSize: 16, fontWeight: '700', color: c.text, minWidth: 90, textAlign: 'center' },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchLabel: { fontSize: 16, fontWeight: '600', color: c.text },
    testBtn: {
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.border,
    },
    testBtnText: { fontSize: 14, fontWeight: '600', color: c.textSub },
    debugBtn: { gap: 0 },
  });
}

export default function SettingsScreen() {
  const { animations, setAnimations, theme, setTheme, dayStartHour, setDayStartHour, reminderEnabled, setReminderEnabled, reminderHour, setReminderHour, graphShowValues, setGraphShowValues } = useSettings();
  const c = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.card}>
            <Text style={styles.settingLabel}>Day starts at</Text>
            <Text style={styles.settingDescription}>
              Your day starts at this time. Entries logged earlier belong to the day before.
            </Text>
            <View style={styles.stepperRow}>
              <AnimatedButton
                style={styles.stepBtn}
                onPress={() => setDayStartHour(dayStartHour <= DAY_START_MIN ? DAY_START_MAX : dayStartHour - 1)}>
                <Text style={styles.stepBtnText}>−</Text>
              </AnimatedButton>
              <Text style={styles.stepValue}>{formatDayStartHour(dayStartHour)}</Text>
              <AnimatedButton
                style={styles.stepBtn}
                onPress={() => setDayStartHour(dayStartHour >= DAY_START_MAX ? DAY_START_MIN : dayStartHour + 1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </AnimatedButton>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Daily Reminder</Text>
              <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
            </View>
            <Text style={styles.settingDescription}>
              Get a daily notification to fill in your trackers.
            </Text>
            {reminderEnabled && (
              <>
                <View style={styles.stepperRow}>
                  <AnimatedButton
                    style={styles.stepBtn}
                    onPress={() => setReminderHour((reminderHour - 1 + 24) % 24)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </AnimatedButton>
                  <Text style={styles.stepValue}>{formatHour(reminderHour)}</Text>
                  <AnimatedButton
                    style={styles.stepBtn}
                    onPress={() => setReminderHour((reminderHour + 1) % 24)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </AnimatedButton>
                </View>
                <AnimatedButton style={styles.testBtn} onPress={sendTestNotification}>
                  <Text style={styles.testBtnText}>Send test notification</Text>
                </AnimatedButton>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Graph</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Show values</Text>
              <Switch value={graphShowValues} onValueChange={setGraphShowValues} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>
              Choose between light, dark, or system-controlled appearance.
            </Text>
            <View style={styles.segmentRow}>
              {THEME_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, theme === opt.value && styles.segmentActive]}
                  onPress={() => setTheme(opt.value)}>
                  <Text style={[styles.segmentText, theme === opt.value && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.optionDescription}>
              {THEME_OPTIONS.find((o) => o.value === theme)?.description}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <View style={styles.card}>
            <Text style={styles.settingLabel}>Animations</Text>
            <Text style={styles.settingDescription}>
              Control whether animations play throughout the app.
            </Text>
            <View style={styles.segmentRow}>
              {ANIMATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, animations === opt.value && styles.segmentActive]}
                  onPress={() => setAnimations(opt.value)}>
                  <Text style={[styles.segmentText, animations === opt.value && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.optionDescription}>
              {ANIMATION_OPTIONS.find((o) => o.value === animations)?.description}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <AnimatedButton
            style={[styles.card, styles.debugBtn]}
            onPress={() => router.push('/character-builder')}>
            <Text style={[styles.settingLabel, { color: c.text }]}>Character</Text>
          </AnimatedButton>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug</Text>
          <AnimatedButton
            style={[styles.card, styles.debugBtn]}
            onPress={() => router.push('/streak-test')}>
            <Text style={[styles.settingLabel, { color: c.text }]}>Streak animation test</Text>
          </AnimatedButton>
        </View>

      </ScrollView>
    </View>
  );
}
