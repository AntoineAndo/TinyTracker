export type TrackerType = 'boolean' | 'count' | 'range' | 'log';
export type ReminderFrequency = 'daily' | 'weekly' | 'custom';
export type TrackerColor = 'green' | 'blue' | 'red' | 'orange' | 'yellow' | 'purple' | 'pink' | 'teal';
export type TrackerIcon = string;

export interface TrackerReminder {
  enabled: boolean;
  /** Days of week: 0 = Monday … 6 = Sunday */
  days: number[];
  hour: number;   // 0–23
  minute: number; // 0–59
}

export interface Tracker {
  id: string;
  name: string;
  type: TrackerType;
  target?: number;
  direction?: 'up' | 'down';
  /** Optional soft lower reference for 'log' trackers. Cosmetic only — no auto-complete. */
  min?: number;
  /** Optional soft upper reference for 'log' trackers. Cosmetic only — no blocking. */
  max?: number;
  color: TrackerColor;
  icon: TrackerIcon;
  reminderFrequency: ReminderFrequency;
  /** Number of days between entries. Only used when reminderFrequency === 'custom'. */
  frequencyDays?: number;
  reminder?: TrackerReminder;
  /** Whether this tracker represents a goal (streak shown, "Done" label) or a neutral
   *  observation (no streak, "Yes" label). Defaults to 'goal' when absent. */
  orientation?: 'goal' | 'neutral';
  createdAt: string;
}

export interface Entry {
  id: string;
  trackerId: string;
  value: boolean | number;
  /** Used by 'log' trackers — true when the user explicitly marks the entry as done. */
  completed?: boolean;
  createdAt: string;
  /** The dayStartHour setting active when this entry was created. Frozen at creation time
   *  so that changing the setting later does not re-bucket historical entries. */
  dayStartHour: number;
}

export interface ChunkMeta {
  id: string;
  /** Logical day string "YYYY-MM-DD" of the first entry in this chunk. */
  from: string;
  /** Logical day string "YYYY-MM-DD" of the last entry, or "present" for the active chunk. */
  to: string;
}

export type ChunkIndex = ChunkMeta[];

export interface RoutineTracker {
  id: string;
  /** For count trackers only: how many completions satisfy this routine.
   *  Defaults to the tracker's own target when absent. */
  routineTarget?: number;
}

export interface Routine {
  id: string;
  name: string;
  /** Ordered trackers belonging to this routine, with optional per-routine targets */
  trackers: RoutineTracker[];
  /** Active days of week: 0 = Monday … 6 = Sunday */
  days: number[];
  startHour: number;    // 0–23
  startMinute: number;  // 0–59
  endHour: number;      // 0–23
  endMinute: number;    // 0–59
  /** Send a reminder 30 min before end time when not all trackers are completed */
  reminderEnabled: boolean;
  createdAt: string;
}
