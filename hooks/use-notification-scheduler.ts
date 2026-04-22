import { useEffect } from 'react';

import { useSettings } from '@/context/settings-context';
import { useTrackers } from '@/context/trackers-context';
import { useRoutines } from '@/context/routines-context';
import type { Routine, Tracker } from '@/lib/types';

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
export const DONE_ACTION = 'done';

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
  // Generic tracker reminder — only has "Remind me later"
  Notifications.setNotificationCategoryAsync('tracker_reminder', [
    {
      identifier: REMIND_LATER_ACTION,
      buttonTitle: 'Remind me later',
      options: { opensAppToForeground: false },
    },
  ]);
  // Boolean goal tracker reminder — adds a "Done" action that dismisses without opening the app
  Notifications.setNotificationCategoryAsync('boolean_goal_reminder', [
    {
      identifier: DONE_ACTION,
      buttonTitle: 'Done',
      options: { opensAppToForeground: false },
    },
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

      // Boolean goal trackers get a "Done" action so the user can log directly from the notification
      const categoryIdentifier = tracker.type === 'boolean' && tracker.orientation !== 'neutral'
        ? 'boolean_goal_reminder'
        : 'tracker_reminder';

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: tracker.name,
          body: `Time to log your ${tracker.name}`,
          data: { trackerId: tracker.id, trackerName: tracker.name },
          categoryIdentifier,
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

// ─── Routine reminders ────────────────────────────────────────────────────────

function routineNotificationId(routineId: string, day: number): string {
  return `routine-${routineId}-day-${day}`;
}

/** Returns the reminder time (30 min before end) or null if unschedulable (e.g. end < 00:30). */
function routineReminderTime(endHour: number, endMinute: number): { hour: number; minute: number } | null {
  let minute = endMinute - 30;
  let hour = endHour;
  if (minute < 0) {
    minute += 60;
    hour -= 1;
  }
  if (hour < 0) return null;
  return { hour, minute };
}

/**
 * Syncs all scheduled per-routine notifications. Mirrors syncTrackerReminders —
 * cancels stale entries and schedules new weekly notifications for each
 * (routine, day) pair where reminderEnabled is true.
 */
export async function syncRoutineReminders(routines: Routine[]): Promise<void> {
  if (!Notifications) return;

  const enabledRoutines = routines.filter((r) => r.reminderEnabled && r.days.length > 0);

  if (enabledRoutines.length > 0) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledById = new Map(scheduled.map((n) => [n.identifier, n]));

  const expectedIds = new Set<string>();
  for (const routine of enabledRoutines) {
    for (const day of routine.days) {
      expectedIds.add(routineNotificationId(routine.id, day));
    }
  }

  // Cancel stale routine notifications
  for (const notification of scheduled) {
    if (
      notification.identifier.startsWith('routine-') &&
      !expectedIds.has(notification.identifier)
    ) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  // Schedule new or updated notifications
  for (const routine of enabledRoutines) {
    const reminderTime = routineReminderTime(routine.endHour, routine.endMinute);
    if (!reminderTime) continue;

    for (const day of routine.days) {
      const id = routineNotificationId(routine.id, day);
      const existing = scheduledById.get(id);

      if (existing) {
        const trigger = existing.trigger as { hour?: number; minute?: number };
        // DATE triggers (one-shot skips) don't have hour/minute — always replace them
        // with the correct weekly trigger so the schedule self-heals on app open.
        if (trigger?.hour === reminderTime.hour && trigger?.minute === reminderTime.minute) continue;
        await Notifications.cancelScheduledNotificationAsync(id);
      }

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: routine.name,
          body: `Your ${routine.name} ends soon — mark it done!`,
          data: { routineId: routine.id, routineName: routine.name },
          categoryIdentifier: 'tracker_reminder',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(day),
          hour: reminderTime.hour,
          minute: reminderTime.minute,
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

/**
 * Cancels today's routine reminder by replacing the weekly trigger with a one-shot
 * DATE trigger for next week's occurrence. On next app open, syncRoutineReminders
 * detects the DATE trigger and restores the weekly schedule.
 */
export async function cancelRoutineNotificationForToday(
  routineId: string,
  routineDays: number[],
  endHour: number,
  endMinute: number,
): Promise<void> {
  if (!Notifications) return;

  // app convention: 0 = Monday … 6 = Sunday
  const todayDow = (new Date().getDay() + 6) % 7;
  if (!routineDays.includes(todayDow)) return;

  const reminderTime = routineReminderTime(endHour, endMinute);
  if (!reminderTime) return;

  const id = routineNotificationId(routineId, todayDow);
  await Notifications.cancelScheduledNotificationAsync(id);

  // Schedule a one-shot for next week at the same time. syncRoutineReminders will
  // replace it with the weekly trigger the next time the app opens.
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(reminderTime.hour, reminderTime.minute, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: 'routine-resync',
      body: '',
      data: { routineId, _resync: true },
      categoryIdentifier: 'tracker_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextWeek,
    },
  });
}

export function useRoutineReminderScheduler() {
  const { routines, isRoutineCompleted } = useRoutines();

  const reminderKey = JSON.stringify(
    routines.map((r) => ({
      id: r.id,
      days: r.days,
      endHour: r.endHour,
      endMinute: r.endMinute,
      reminderEnabled: r.reminderEnabled,
    })),
  );

  // Re-sync weekly triggers when routine config changes
  useEffect(() => {
    if (!Notifications) return;
    syncRoutineReminders(routines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey]);

  // Cancel today's notification when a routine becomes fully completed.
  // completionKey changes whenever an enabled routine's completion status flips.
  const completionKey = JSON.stringify(
    routines
      .filter((r) => r.reminderEnabled)
      .map((r) => ({ id: r.id, done: isRoutineCompleted(r) })),
  );

  useEffect(() => {
    if (!Notifications) return;
    for (const routine of routines) {
      if (!routine.reminderEnabled) continue;
      if (isRoutineCompleted(routine)) {
        cancelRoutineNotificationForToday(routine.id, routine.days, routine.endHour, routine.endMinute);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionKey]);
}
