/**
 * Returns the logical calendar day for a given Date, accounting for a custom
 * day-start hour (range -12 to +12).
 *
 * Positive values shift the boundary after midnight:
 *   dayStartHour=3  → day starts at 3:00 AM; a 2:00 AM timestamp belongs to the previous day.
 *
 * Negative values shift the boundary before midnight:
 *   dayStartHour=-2 → day starts at 10:00 PM; a 11:00 PM timestamp already belongs to the next day.
 *
 * Implementation: subtract `dayStartHour` hours from the timestamp, then read
 * the resulting calendar date. This handles both signs uniformly.
 */
export function getLogicalDay(date: Date, dayStartHour: number = 0): Date {
  if (dayStartHour === 0) return new Date(date);
  return new Date(date.getTime() - dayStartHour * 60 * 60 * 1000);
}

/**
 * Returns the current logical day, accounting for a custom day-start hour.
 * Pass `dayStartHour` from settings so the boundary shifts accordingly.
 */
export function getCurrentDay(dayStartHour: number = 0): Date {
  return getLogicalDay(new Date(), dayStartHour);
}

/** Compares two dates by calendar day only (ignores time). */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Normalises a boolean|number entry value to a number. */
export function toNumericValue(value: boolean | number): number {
  return typeof value === 'boolean' ? (value ? 1 : 0) : value;
}

/**
 * Returns the number of consecutive completed days for a boolean or count tracker,
 * ending at (and including) today if today's entry is completed.
 * Returns 0 for other tracker types.
 */
export function getStreak(tracker: import('./types').Tracker, trackerEntries: import('./types').Entry[], today: Date): number {
  if (tracker.type !== 'boolean' && tracker.type !== 'count') return 0;

  let streak = 0;
  const checkDay = new Date(today);
  checkDay.setHours(0, 0, 0, 0);

  for (;;) {
    const dayStr = checkDay.toDateString();
    const entry = trackerEntries.find(
      (e) => getLogicalDay(new Date(e.createdAt), e.dayStartHour ?? 0).toDateString() === dayStr
    );
    if (!entry) break;
    const val = toNumericValue(entry.value);
    const completed = tracker.type === 'boolean' ? val === 1 : val >= (tracker.target ?? 1);
    if (!completed) break;
    streak++;
    checkDay.setDate(checkDay.getDate() - 1);
  }

  return streak;
}

/** Returns the interval in days for a tracker based on its frequency setting. */
export function trackerInterval(tracker: import('./types').Tracker): number {
  if (tracker.reminderFrequency === 'weekly') return 7;
  if (tracker.reminderFrequency === 'custom') return tracker.frequencyDays ?? 1;
  return 1;
}

/**
 * Returns the logical date the tracker is next due.
 * If no entries exist, it is immediately due (returns today).
 * Otherwise: last entry's logical day + interval.
 */
export function nextDueDate(
  tracker: import('./types').Tracker,
  trackerEntries: import('./types').Entry[],
  today: Date,
): Date {
  const interval = trackerInterval(tracker);
  if (trackerEntries.length === 0) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const last = trackerEntries.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  const lastDay = getLogicalDay(new Date(last.createdAt), last.dayStartHour ?? 0);
  lastDay.setHours(0, 0, 0, 0);
  lastDay.setDate(lastDay.getDate() + interval);
  return lastDay;
}

/** Formats a Date as "YYYY-MM-DD" using its local calendar fields. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses a "YYYY-MM-DD" string to a Date at local midnight. */
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Converts a CSS hex colour string to RGB components. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
