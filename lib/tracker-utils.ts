import { Entry, Routine, Tracker } from './types';
import { toNumericValue } from './utils';

/** How long to show a completion celebration before dismissing the tracker row. */
export const COMPLETION_CELEBRATION_MS = 750;

/** Returns true when the current time (in minutes since midnight) falls within the routine's window. */
export function isRoutineActive(routine: Routine, nowMinutes: number): boolean {
  const startMinutes = routine.startHour * 60 + routine.startMinute;
  const endMinutes = routine.endHour * 60 + routine.endMinute;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

/**
 * Returns true when a tracker's current-period entry satisfies its completion criteria.
 * Pass `routineTarget` to override the tracker's own target for count trackers inside a routine.
 */
export function isCompleted(tracker: Tracker, entry: Entry | undefined, routineTarget?: number): boolean {
  if (!entry) return false;
  if (tracker.type === 'log') return entry.completed === true;
  const val = toNumericValue(entry.value);
  // Neutral boolean: any logged answer (Yes or No) counts as completed for the day.
  if (tracker.type === 'boolean') return tracker.orientation === 'neutral' ? true : val === 1;
  if (tracker.type === 'count') return val >= (routineTarget ?? tracker.target ?? 1);
  // Range trackers are considered completed as soon as any value is saved.
  return true;
}

/**
 * Returns true when a tracker should render as a checkbox control.
 * Applies to boolean goal trackers and count trackers whose effective target is 1
 * (semantically identical to done/not-done).
 */
export function isCheckboxControl(tracker: Tracker, routineTarget?: number): boolean {
  if (tracker.type === 'boolean') return tracker.orientation !== 'neutral';
  if (tracker.type === 'count') return (routineTarget ?? tracker.target ?? 1) === 1;
  return false;
}

/**
 * Returns true when saving `value` for this tracker would complete it.
 * Used to decide whether to trigger the celebration-then-dismiss animation.
 * Pass `routineTarget` when the tracker is inside a routine so the effective
 * target matches what `isCompleted` and `isCheckboxControl` use.
 */
export function wouldComplete(tracker: Tracker, value: number, routineTarget?: number): boolean {
  if (tracker.type === 'log') return false;
  // Neutral boolean: both Yes (1) and No (0) complete the tracker.
  if (tracker.type === 'boolean') return tracker.orientation === 'neutral' ? true : value === 1;
  if (tracker.type === 'count') return value >= (routineTarget ?? tracker.target ?? 1);
  // Range trackers complete on any value selection.
  return true;
}
