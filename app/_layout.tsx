import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, useFonts } from '@expo-google-fonts/instrument-serif';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import 'react-native-reanimated';

import { RoutinesProvider } from '@/context/routines-context';
import { SettingsProvider } from '@/context/settings-context';
import { TrackersProvider, useTrackers } from '@/context/trackers-context';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import {
  DONE_ACTION,
  Notifications,
  REMIND_LATER_ACTION,
  scheduleRemindLater,
  scheduleTrackerRemindLater,
  useNotificationScheduler,
  useRoutineReminderScheduler,
  useTrackerReminderScheduler,
} from '@/hooks/use-notification-scheduler';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

// Renders inside TrackersProvider so it can access useTrackers()
function TrackerReminderSync() {
  useTrackerReminderScheduler();
  return null;
}

// Renders inside RoutinesProvider so it can access useRoutines()
function RoutineReminderSync() {
  useRoutineReminderScheduler();
  return null;
}

// Renders inside TrackersProvider to handle notification actions that mutate tracker data
function NotificationActionHandler() {
  const { addEntry } = useTrackers();
  const router = useRouter();

  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        trackerId?: string;
        trackerName?: string;
      } | undefined;

      if (response.actionIdentifier === DONE_ACTION && data?.trackerId) {
        // Mark the boolean tracker as done directly from the notification without opening the app
        addEntry({ trackerId: data.trackerId, value: 1 });
      } else if (response.actionIdentifier === REMIND_LATER_ACTION) {
        if (data?.trackerId) {
          scheduleTrackerRemindLater(data.trackerId, data.trackerName ?? '');
        } else {
          scheduleRemindLater();
        }
      } else {
        // Default tap: open the tracker detail or today screen
        if (data?.trackerId) {
          router.push(`/tracker/${data.trackerId}`);
        } else {
          router.push('/(tabs)/today');
        }
      }
    });
    return () => sub.remove();
  }, [addEntry, router]);

  return null;
}

function RootLayoutNav() {
  const colorScheme = useAppColorScheme();
  const animationsEnabled = useAnimationsEnabled();
  useNotificationScheduler();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TrackersProvider>
        <RoutinesProvider>
          <TrackerReminderSync />
          <RoutineReminderSync />
          <NotificationActionHandler />
          <Stack screenOptions={{ animation: animationsEnabled ? undefined : 'none' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="new-tracker" options={{ title: 'New Tracker' }} />
            <Stack.Screen name="tracker/[id]" options={{ title: '' }} />
            <Stack.Screen name="edit-tracker/[id]" options={{ title: 'Edit Tracker' }} />
            <Stack.Screen name="character-builder" options={{ title: 'Character' }} />
            <Stack.Screen name="new-routine" options={{ title: 'New Routine' }} />
            <Stack.Screen name="edit-routine/[id]" options={{ title: 'Edit Routine' }} />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </RoutinesProvider>
      </TrackersProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SettingsProvider>
      <RootLayoutNav />
    </SettingsProvider>
  );
}
