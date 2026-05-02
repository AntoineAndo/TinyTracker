// Deterministic mock dataset used when "mock mode" is toggled in settings.
//
// Nine trackers (Mood, Productivity, Sleep, Stress, Hydration, Exercise,
// Steps, Pages read, Screen time) are generated over 60 days from a single
// underlying "wellbeing" latent factor. Values are wired so a Patterns /
// Insights view can surface a coherent set of plausible findings:
//
// Correlations baked in:
//   1. Last night's sleep -> today's mood + productivity (1-day lag).
//   2. Today's screen time -> tonight's sleep -> tomorrow's mood (chained lag).
//   3. Exercise day -> better mood, sleep, more steps, lower stress.
//   4. Stress runs inverse to hydration and sleep.
//   5. Pages read up -> stress down (reading as decompression).
//   6. Step volume up -> sleep up the same night (continuous boost on top of
//      the binary exercise effect; step count itself partly tracks exercise).
//   7. Screen time up -> pages read down (substitution effect).
//   8. Interaction: exercise AND good sleep (>=4) -> extra productivity bump
//      next day, beyond either factor alone.
//
// Temporal layers added on top of the latent factor:
//   - Weekday / weekend rhythm: weekends bring more sleep + screen, fewer
//     steps, lower productivity, slightly less stress.
//   - A "rough patch" week (days 35..41 ago): wellbeing dips ~1.0 so charts
//     show a visible trough.
//   - Gradual upward trend across the 60 days (+0.6 wellbeing total) so the
//     overall chart slopes toward improvement.
//
// Adherence is near-complete (~95% of days logged per tracker, rolled
// independently so missing days differ slightly between trackers) so the
// correlations stay clean for the demo; no weekend gaps.

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
];

// Latent "good day" factor in roughly [-2, +2]. Built from:
//   - two sines (rich phase structure, no rigid lock-step)
//   - a linear improvement trend over the 60-day window
//   - a punched-out rough-patch week mid-window
//   - small per-day noise so days are not perfectly determined
function wellbeing(d: number): number {
  const base = Math.sin(d / 9) + Math.sin(d / 27) * 0.6;
  const trend = ((60 - d) / 60) * 0.6;
  const roughPatch = d >= 35 && d <= 41 ? -1.0 : 0;
  return base + trend + roughPatch + noise(d * 7, 0.25);
}

function clampRange(x: number): number {
  return Math.min(5, Math.max(1, Math.round(x)));
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function generateEntries(): Entry[] {
  const entries: Entry[] = [];

  // Carry yesterday's values forward (loop runs oldest -> newest).
  // "Yesterday" here means the previous calendar day relative to the current
  // iteration, used for lagged correlations (sleep -> mood/productivity).
  let prevSleep: number | null = null;
  let prevExercise: boolean | null = null;

  for (let d = 60; d >= 0; d--) {
    const w = wellbeing(d);
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(20, 0, 0, 0);
    const dayStartHour = 3;

    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const weekendSleepBonus = isWeekend ? 0.5 : 0;
    const weekendScreenBonus = isWeekend ? 25 : 0;
    const weekendStepPenalty = isWeekend ? -1800 : 0;
    const weekendProdPenalty = isWeekend ? -0.5 : 0;
    const weekendStressRelief = isWeekend ? -0.3 : 0;
    const weekendExercisePenalty = isWeekend ? -0.1 : 0;

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

    // ~95% adherence per tracker (uniform). Decision RNGs are seeded per
    // tracker so missing days are stable across regenerations.
    const logged = (salt: number) => rand(d * 101 + salt) > 0.05;

    // 1) Exercise (binary). Drives downstream sleep / steps / mood / stress.
    const didExercise = rand(d * 11 + 1) + 0.30 * w + weekendExercisePenalty > 0.50;
    if (logged(1)) push('mt2', didExercise);

    // 2) Screen time (minutes). Inverse to wellbeing; weekends scroll more.
    //    Negative input to tonight's sleep and to today's pages read.
    const screen = Math.max(20, Math.round(95 - 18 * w + weekendScreenBonus + noise(d * 79, 22)));
    const screenZ = (screen - 95) / 40; // ~[-2, +2]; positive = lots of screen
    if (logged(2)) push('mt9', screen, d > 0 && rand(d * 73 + 10) > 0.10);

    // 3) Steps. Wellbeing + exercise bonus + weekend dip.
    //    Step volume separately nudges sleep upward (above the binary boost).
    const steps = Math.max(2000, Math.round(
      7500 + 900 * w + (didExercise ? 1500 : 0) + weekendStepPenalty + noise(d * 71, 1500)
    ));
    const stepsZ = (steps - 7500) / 3500;
    if (logged(3)) push('mt8', steps, d > 0 && rand(d * 67 + 9) > 0.10);

    // 4) Sleep (1..5). Wellbeing + exercise + step volume + weekend bonus,
    //    with a screen-time penalty so high-screen days produce worse sleep.
    //    Wellbeing kept modest so the directly wired inputs (screen / steps /
    //    exercise) account for most of the variance, not a shared latent.
    const sleepRaw = 3
      + 0.30 * w
      + (didExercise ? 0.30 : 0)
      + 0.35 * stepsZ
      - 0.40 * screenZ
      + weekendSleepBonus
      + noise(d * 29, 0.55);
    const sleep = clampRange(sleepRaw);
    if (logged(4)) push('mt3', sleep);

    // 5) Hydration (count, target 3, capped at 4). Mild positive with
    //    wellbeing; later contributes to lower stress.
    const hydration = clamp(1, 4, Math.round(2.4 + 0.25 * w + noise(d * 53, 0.8)));
    if (logged(5)) push('mt5', hydration);

    // 6) Pages read. Light wellbeing + screen-time substitution penalty
    //    (substitution is the dominant driver, not shared wellbeing).
    const pages = Math.max(0, Math.round(22 + 3 * w - 5 * screenZ + noise(d * 61, 10)));
    const pagesZ = (pages - 22) / 12;
    if (logged(6)) push('mt7', pages, d > 0 && rand(d * 59 + 8) > 0.10);

    // 7) Stress (1..5, direction='down'). Light inverse wellbeing, plus
    //    relief from reading and hydration; weekends slightly less stressful.
    //    Direct inputs do most of the work so stress is not a wellbeing clone.
    const stressRaw = 3
      - 0.30 * w
      - 0.45 * pagesZ
      - 0.30 * (hydration - 2.5)
      + weekendStressRelief
      + noise(d * 43, 0.55);
    const stress = clampRange(stressRaw);
    if (logged(7)) push('mt6', stress);

    // 8) Mood (1..5). Mostly driven by last night's sleep (lagged) with a
    //    small wellbeing component and same-day exercise bump.
    const yesterdaySleepEffect = prevSleep != null ? 0.55 * (prevSleep - 3) : 0;
    const moodRaw = 3
      + 0.20 * w
      + yesterdaySleepEffect
      + (didExercise ? 0.20 : 0)
      + noise(d * 19, 0.55);
    if (logged(8)) push('mt1', clampRange(moodRaw));

    // 9) Productivity (1..5). Lagged sleep + interaction bonus when
    //    yesterday combined exercise with good sleep. Weekend penalty keeps
    //    weekday / weekend rhythm visible.
    const interactionBonus = prevExercise === true && prevSleep != null && prevSleep >= 4 ? 0.5 : 0;
    const prodRaw = 3
      + 0.18 * w
      + (prevSleep != null ? 0.50 * (prevSleep - 3) : 0)
      + interactionBonus
      + weekendProdPenalty
      + noise(d * 37, 0.55);
    if (logged(9)) push('mt4', clampRange(prodRaw));

    prevSleep = sleep;
    prevExercise = didExercise;
  }

  return entries;
}

export const MOCK_ENTRIES: Entry[] = generateEntries();
