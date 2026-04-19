// Legacy key → emoji map (for trackers saved before free-form emoji was added)
const LEGACY_ICONS: Record<string, string> = {
  brain:    '🧠',
  peach:    '🍑',
  money:    '💰',
  biceps:   '💪',
  sleeping: '😴',
};

export const DEFAULT_ICON = '🧠';

/** Accepts either a legacy key ('brain') or a direct emoji ('🧠'). */
export function resolveIcon(icon: string | undefined): string {
  if (!icon) return DEFAULT_ICON;
  if (LEGACY_ICONS[icon]) return LEGACY_ICONS[icon];
  return icon;
}

/**
 * Returns the display icon for a tracker, or an empty string if none is set.
 * Unlike resolveIcon(), this does NOT fall back to a default emoji.
 */
export function getTrackerIcon(icon: string): string {
  return icon ? resolveIcon(icon) : '';
}

/** Returns the first emoji character in a string, or null if none found. */
export function extractEmoji(text: string): string | null {
  const m = text.match(/\p{Extended_Pictographic}/u);
  return m ? m[0] : null;
}
