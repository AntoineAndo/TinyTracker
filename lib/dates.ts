/** Day abbreviations in JS convention: index 0 = Sunday (matches Date.getDay()). */
export const DAY_NAMES_JS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Day abbreviations in Routine.days convention: index 0 = Monday. */
export const DAY_NAMES_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Converts a JS Date's day-of-week to the Routine.days convention (0 = Monday ... 6 = Sunday). */
export function toRoutineDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7;
}
