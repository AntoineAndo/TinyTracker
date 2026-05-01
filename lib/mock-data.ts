// Deterministic mock dataset used when "mock mode" is toggled in settings.
// Values are generated from a single underlying "wellbeing" latent factor so
// that the Patterns / Insights feature surfaces intuitive correlations:
//
//   - mood, sleep, productivity all rise and fall together (positive ρ)
//   - stress and screen time run opposite (mood up → stress and screen down)
//   - exercise days nudge sleep and steps upward (binary × continuous)
//   - calories is intentionally independent (a control to keep findings honest)
//
// Trackers and per-day logging frequencies are kept in shape with the prior
// fixture so visual mocks of the graph still look populated.

import { Entry, Tracker } from './types';

// Deterministic pseudo-random in [0, 1).
function rand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// Symmetric pseudo-noise in [-amp, amp].
function noise(seed: number, amp: number): number {
  return (rand(seed) - 0.5) * 2 * amp;
}

const now = new Date();
const trackerStart = new Date(now);
trackerStart.setDate(trackerStart.getDate() - 65);

export const MOCK_TRACKERS: Tracker[] = [
  { id: 'mt1', name: 'Mood',         type: 'range',   color: 'blue',   icon: '🧠', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt2', name: 'Exercise',     type: 'boolean', color: 'green',  icon: '💪', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt3', name: 'Sleep',        type: 'range',   color: 'purple', icon: '😴', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt4', name: 'Productivity', type: 'range',   color: 'orange', icon: '🧠', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt5', name: 'Hydration',    type: 'count',   target: 3, color: 'yellow', icon: '🍑', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt6', name: 'Stress',       type: 'range',   direction: 'down', color: 'red',    icon: '😤', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt7', name: 'Pages read',   type: 'log',     color: 'teal',   icon: '📚', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt8', name: 'Steps',        type: 'log',     min: 8000, color: 'green',  icon: '🚶', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt9', name: 'Screen time',  type: 'log',     max: 120,  color: 'red',    icon: '📱', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
  { id: 'mt10', name: 'Calories',    type: 'log',     min: 1800, max: 2400, color: 'orange', icon: '🍽️', reminderFrequency: 'daily', createdAt: trackerStart.toISOString() },
];

// Latent factor that drives most other trackers; roughly [-1.6, 1.6]. Higher
// means a "good day". Two oscillations combined give richer phase structure
// than a single sine; the small per-day noise prevents rigid lock-step.
function wellbeing(d: number): number {
  return Math.sin(d / 9) + Math.sin(d / 27) * 0.6 + noise(d * 7, 0.3);
}

function clampRange(x: number): number {
  return Math.min(5, Math.max(1, Math.round(x)));
}

function generateEntries(): Entry[] {
  const entries: Entry[] = [];

  for (let d = 60; d >= 0; d--) {
    const w = wellbeing(d);
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(20, 0, 0, 0);
    const dayStartHour = 3;

    const push = (trackerId: string, value: boolean | number, completed?: boolean) => {
      entries.push({
        id: `me-${trackerId}-${d}`,
        trackerId,
        value,
        ...(completed !== undefined && { completed }),
        createdAt: date.toISOString(),
        dayStartHour,
      });
    };

    // Exercise: more likely on positive-wellbeing days. Reused below for
    // sleep and steps to add a binary × continuous signal on top of the
    // shared latent factor.
    const didExercise = rand(d * 11 + 1) + 0.30 * w > 0.50;
    if (rand(d * 13 + 2) > 0.15) push('mt2', didExercise);

    // Mood: strongest direct expression of wellbeing.
    if (rand(d * 17 + 3) > 0.10) {
      push('mt1', clampRange(3 + 1.0 * w + noise(d * 19, 0.30)));
    }

    // Sleep: wellbeing-driven with a small bonus on exercise days.
    if (rand(d * 23 + 4) > 0.15) {
      const sleep = clampRange(3 + 0.85 * w + (didExercise ? 0.25 : 0) + noise(d * 29, 0.50));
      push('mt3', sleep);
    }

    // Productivity: shared latent factor; deliberately tight to mood so the
    // "lower mood → lower productivity" pair surfaces near the top.
    if (rand(d * 31 + 5) > 0.18) {
      push('mt4', clampRange(3 + 1.0 * w + noise(d * 37, 0.30)));
    }

    // Stress (direction='down'): inverse of wellbeing → strong negative
    // correlation with mood/sleep/productivity, strong positive with screen.
    if (rand(d * 41 + 6) > 0.22) {
      push('mt6', clampRange(3 - 0.9 * w + noise(d * 43, 0.35)));
    }

    // Hydration (count, target 3): mild positive with wellbeing.
    if (rand(d * 47 + 7) > 0.30) {
      const hyd = Math.min(4, Math.max(1, Math.round(2.2 + 0.4 * w + noise(d * 53, 0.7))));
      push('mt5', hyd);
    }

    // Pages read: mild positive with wellbeing. Coefficient kept modest so
    // Pages does not dominate the rankings (it has a lot of headroom and
    // would otherwise correlate spuriously high with everything).
    {
      const r = rand(d * 59 + 8);
      if (r > 0.30) {
        const pages = Math.max(0, Math.round(22 + 7 * w + noise(d * 61, 11)));
        const completed = d > 0 && r > 0.40;
        push('mt7', pages, completed);
      }
    }

    // Steps: wellbeing + smaller exercise-day bonus (kept modest so the
    // tautological "exercise → steps" finding does not crowd out the more
    // interesting mood/sleep/screen-time pairs).
    {
      const r = rand(d * 67 + 9);
      if (r > 0.18) {
        const steps = Math.max(2000, Math.round(7500 + 1800 * w + (didExercise ? 1200 : 0) + noise(d * 71, 1200)));
        const completed = d > 0 && r > 0.28;
        push('mt8', steps, completed);
      }
    }

    // Screen time: NEGATIVELY correlated with wellbeing → surfaces as
    // "On low-mood days, screen time runs higher" once analyzed.
    {
      const r = rand(d * 73 + 10);
      if (r > 0.18) {
        const screen = Math.max(20, Math.round(95 - 38 * w + noise(d * 79, 16)));
        const completed = d > 0 && r > 0.28;
        push('mt9', screen, completed);
      }
    }

    // Calories: intentionally independent. Acts as a control: it should
    // NOT appear among the surfaced findings, which keeps the demo honest.
    {
      const r = rand(d * 83 + 11);
      if (r > 0.25) {
        const cal = Math.round(2100 + noise(d * 89, 350));
        const completed = d > 0 && r > 0.35;
        push('mt10', cal, completed);
      }
    }
  }

  return entries;
}

export const MOCK_ENTRIES: Entry[] = generateEntries();
