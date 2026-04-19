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
