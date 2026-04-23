import { TrackerColor } from './types';

export const TRACKER_COLORS: Record<TrackerColor, { hex: string; label: string }> = {
  green:  { hex: '#22c55e', label: 'Green'  },
  blue:   { hex: '#3b82f6', label: 'Blue'   },
  red:    { hex: '#ef4444', label: 'Red'    },
  orange: { hex: '#f97316', label: 'Orange' },
  yellow: { hex: '#eab308', label: 'Yellow' },
  purple: { hex: '#a855f7', label: 'Purple' },
  pink:   { hex: '#ec4899', label: 'Pink'   },
  teal:   { hex: '#14b8a6', label: 'Teal'   },
};

export const TRACKER_COLOR_ORDER: TrackerColor[] = [
  'green', 'blue', 'red', 'orange', 'yellow', 'purple', 'pink', 'teal',
];

export function getTrackerColorHex(color: TrackerColor): string {
  return TRACKER_COLORS[color].hex;
}

export function getTrackerColorRgba(color: TrackerColor, alpha: number): string {
  const hex = getTrackerColorHex(color);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
