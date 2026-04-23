import { useAppColorScheme } from './use-app-color-scheme';

const lightTheme = {
  scheme: 'light' as const,
  // Warm cream base — matches the mockup's "cream" palette
  background: '#F5F1EA',
  surface: '#EDE8DF',
  card: '#FFFFFF',
  cardAlt: '#F0EBE1',
  border: 'rgba(25,23,20,0.10)',
  borderLight: 'rgba(25,23,20,0.06)',
  text: '#191714',
  textSub: '#6B6459',
  textMuted: '#A39A8C',
  tint: '#F26B4A',
  segmentBg: '#ECE6DB',
  segmentActiveBg: '#FFFFFF',
  segmentActiveShadowOpacity: 0.08,
  toggleActiveBg: '#191714',
  toggleActiveText: '#ffffff',
  gridline: 'rgba(25,23,20,0.06)',
  gridlineEdge: 'rgba(25,23,20,0.10)',
  cellEmpty: '#D8D1C4',
  drawerBg: '#FFFFFF',
};

const darkTheme = {
  scheme: 'dark' as const,
  // Deep blue-black base — matches the mockup's "midnight" palette
  background: '#12121C',
  surface: '#0D0D16',
  card: '#1C1C2B',
  cardAlt: '#1C1C2B',
  border: 'rgba(245,241,234,0.10)',
  borderLight: 'rgba(245,241,234,0.06)',
  text: '#F5F1EA',
  textSub: '#A098B2',
  textMuted: '#6A6280',
  tint: '#F87E5C',
  segmentBg: '#272737',
  segmentActiveBg: '#32324A',
  segmentActiveShadowOpacity: 0,
  toggleActiveBg: '#F5F1EA',
  toggleActiveText: '#12121C',
  gridline: 'rgba(245,241,234,0.05)',
  gridlineEdge: 'rgba(245,241,234,0.10)',
  cellEmpty: '#22223A',
  drawerBg: '#1C1C2B',
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

export function useTheme(): AppTheme {
  const scheme = useAppColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
