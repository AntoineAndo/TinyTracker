import { Entry, Tracker } from './types';

// Deterministic pseudo-random in [0, 1) based on a seed
function rand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const now = new Date();
const trackerStart = new Date(now);
trackerStart.setDate(trackerStart.getDate() - 65);

export const MOCK_TRACKERS: Tracker[] = [
  { id: 'mt1', name: 'Mood',         type: 'range',   direction: undefined, color: 'blue',   icon: '🧠', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt2', name: 'Exercise',     type: 'boolean', color: 'green',  icon: '💪', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt3', name: 'Sleep',        type: 'range',   direction: undefined, color: 'purple', icon: '😴', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt4', name: 'Productivity', type: 'range',   direction: undefined, color: 'orange', icon: '🧠', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt5', name: 'Hydration',    type: 'count',   target: 3, color: 'yellow', icon: '🍑', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt6', name: 'Stress',       type: 'range',   direction: 'down', color: 'red',    icon: '😤', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  // log trackers
  { id: 'mt7', name: 'Pages read',   type: 'log',     color: 'teal',   icon: '📚', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt8', name: 'Steps',        type: 'log',     min: 8000, color: 'green',  icon: '🚶', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt9', name: 'Screen time',  type: 'log',     max: 120,  color: 'red',    icon: '📱', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt10', name: 'Calories',    type: 'log',     min: 1800, max: 2400, color: 'orange', icon: '🍽️', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
];

function generateEntries(): Entry[] {
  const entries: Entry[] = [];

  MOCK_TRACKERS.forEach((tracker, ti) => {
    for (let d = 60; d >= 0; d--) {
      const seed = ti * 1000 + d;
      const fillThreshold = tracker.type === 'range' ? 0.15 : tracker.type === 'log' ? 0.20 : 0.30;
      if (rand(seed) < fillThreshold) continue;

      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(20, 0, 0, 0);

      let value: boolean | number;
      let completed: boolean | undefined;

      if (tracker.type === 'boolean') {
        value = rand(seed + 0.5) > 0.35;
      } else if (tracker.type === 'count') {
        const target = tracker.target ?? 1;
        value = Math.min(target, Math.max(1, Math.round(rand(seed + 0.5) * target)));
      } else if (tracker.type === 'log') {
        // Generate realistic values per tracker, with some variance day to day
        const wave = Math.sin(d / 10 + ti) * 0.15;
        const r = rand(seed + 0.4);

        if (tracker.id === 'mt7') {
          // Pages read: 10–60 pages/day
          value = Math.round(10 + (r + wave) * 50);
        } else if (tracker.id === 'mt8') {
          // Steps: 5000–14000, centered around the 8000 min
          value = Math.round(5000 + (r + wave) * 9000);
        } else if (tracker.id === 'mt9') {
          // Screen time (minutes): 60–200, max is 120
          value = Math.round(60 + (r + wave) * 140);
        } else {
          // Calories: 1400–2800, min 1800 max 2400
          value = Math.round(1400 + (r + wave) * 1400);
        }

        // ~80% of past entries are completed; today's entry is never completed in mock data
        completed = d > 0 ? rand(seed + 0.9) > 0.20 : false;
      } else {
        // range
        const wave = Math.sin(d / 7 + ti) * 1.5;
        value = Math.min(5, Math.max(1, Math.round(3 + wave + (rand(seed + 0.3) - 0.5))));
      }

      entries.push({
        id: `me-${tracker.id}-${d}`,
        trackerId: tracker.id,
        value,
        ...(completed !== undefined && { completed }),
        createdAt: date.toISOString(),
        dayStartHour: 3,
      });
    }
  });

  return entries;
}

export const MOCK_ENTRIES: Entry[] = generateEntries();
