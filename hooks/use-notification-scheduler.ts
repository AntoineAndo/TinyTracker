import { useEffect } from 'react';

import { useSettings } from '@/context/settings-context';
import { useTrackers } from '@/context/trackers-context';
import type { Tracker } from '@/lib/types';

// expo-notifications crashes on import in Expo Go (SDK 53+). Load it lazily so
// the app still runs in Expo Go — notifications just won't fire.
function getNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

export const Notifications = getNotifications();

export const REMIND_LATER_ACTION = 'remind_later';

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  Notifications.setNotificationCategoryAsync('tracker_reminder', [
    {
      identifier: REMIND_LATER_ACTION,
      buttonTitle: 'Remind me later',
      options: { opensAppToForeground: false },
    },
  ]);
}

// ─── Global daily reminder ────────────────────────────────────────────────────

const GLOBAL_REMINDER_ID = 'daily-tracker-reminder';

const GLOBAL_NOTIFICATION_CONTENT = {
  title: 'Time to track',
  body: 'Fill in your trackers for today.',
  categoryIdentifier: 'tracker_reminder',
};

async function scheduleGlobalReminder(hour: number) {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(GLOBAL_REMINDER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: GLOBAL_REMINDER_ID,
    content: GLOBAL_NOTIFICATION_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}

async function cancelGlobalReminder() {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(GLOBAL_REMINDER_ID);
}

export async function scheduleRemindLater() {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: GLOBAL_NOTIFICATION_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3600,
      repeats: false,
    },
  });
}

export async function sendTestNotification() {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: GLOBAL_NOTIFICATION_CONTENT,
    trigger: null,
  });
}

export function useNotificationScheduler() {
  const { reminderEnabled, reminderHour, setReminderEnabled } = useSettings();

  useEffect(() => {
    if (!reminderEnabled) {
      cancelGlobalReminder();
      return;
    }

    (async () => {
      if (!Notifications) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        setReminderEnabled(false);
        return;
      }
      await scheduleGlobalReminder(reminderHour);
    })();
  }, [reminderEnabled, reminderHour, setReminderEnabled]);
}

// ─── Per-tracker reminders ────────────────────────────────────────────────────

/** expo-notifications weekday: 1=Sunday, 2=Monday … 7=Saturday */
function toExpoWeekday(day: number): number {
  // day: 0=Monday … 6=Sunday
  return ((day + 1) % 7) + 1;
}

function trackerNotificationId(trackerId: string, day: number): string {
  return `tracker-${trackerId}-day-${day}`;
}

/**
 * Syncs all scheduled per-tracker notifications to match the current tracker
 * state. Safe to call on every trackers change — skips notifications that are
 * already scheduled with the correct trigger.
 */
export async function syncTrackerReminders(trackers: Tracker[]): Promise<void> {
  if (!Notifications) return;

  const enabledTrackers = trackers.filter(
    (t) => t.reminder?.enabled && (t.reminder.days.length ?? 0) > 0,
  );

  if (enabledTrackers.length > 0) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledById = new Map(scheduled.map((n) => [n.identifier, n]));

  // Build the set of IDs that should exist
  const expectedIds = new Set<string>();
  for (const tracker of enabledTrackers) {
    for (const day of tracker.reminder!.days) {
      expectedIds.add(trackerNotificationId(tracker.id, day));
    }
  }

  // Cancel stale tracker notifications
  for (const notification of scheduled) {
    if (
      notification.identifier.startsWith('tracker-') &&
      !expectedIds.has(notification.identifier)
    ) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  // Schedule new or updated notifications
  for (const tracker of enabledTrackers) {
    const r = tracker.reminder!;
    for (const day of r.days) {
      const id = trackerNotificationId(tracker.id, day);
      const existing = scheduledById.get(id);

      if (existing) {
        const trigger = existing.trigger as { hour?: number; minute?: number };
        if (trigger?.hour === r.hour && trigger?.minute === r.minute) continue;
        await Notifications.cancelScheduledNotificationAsync(id);
      }

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: tracker.name,
          body: `Time to log your ${tracker.name}`,
          data: { trackerId: tracker.id, trackerName: tracker.name },
          categoryIdentifier: 'tracker_reminder',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(day),
          hour: r.hour,
          minute: r.minute,
        },
      });
    }
  }

  const finalScheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (finalScheduled.length > 60) {
    console.warn(
      `[Notifications] ${finalScheduled.length} scheduled notifications — approaching iOS 64 limit`,
    );
  }
}

/** Re-fires a specific tracker's notification in 1 hour. */
export async function scheduleTrackerRemindLater(
  trackerId: string,
  trackerName: string,
): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: trackerName,
      body: `Time to log your ${trackerName}`,
      data: { trackerId, trackerName },
      categoryIdentifier: 'tracker_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3600,
      repeats: false,
    },
  });
}

export function useTrackerReminderScheduler() {
  const { trackers } = useTrackers();
  // Stable key: only reacts to reminder-relevant changes
  const reminderKey = JSON.stringify(
    trackers.map((t) => ({ id: t.id, reminder: t.reminder })),
  );

  useEffect(() => {
    if (!Notifications) return;
    syncTrackerReminders(trackers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey]);
}
