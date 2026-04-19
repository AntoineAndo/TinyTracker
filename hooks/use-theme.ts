import { useAppColorScheme } from './use-app-color-scheme';

const lightTheme = {
  scheme: 'light' as const,
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#ffffff',
  cardAlt: '#f7f7f7',
  border: '#dddddd',
  borderLight: '#eeeeee',
  text: '#11181C',
  textSub: '#687076',
  textMuted: '#aaaaaa',
  tint: '#0a7ea4',
  segmentBg: '#f0f0f0',
  segmentActiveBg: '#ffffff',
  segmentActiveShadowOpacity: 0.1,
  toggleActiveBg: '#11181C',
  toggleActiveText: '#ffffff',
  gridline: '#efefef',
  gridlineEdge: '#dddddd',
  cellEmpty: '#e0e0e0',
  drawerBg: '#ffffff',
};

const darkTheme = {
  scheme: 'dark' as const,
  background: '#151718',
  surface: '#1a1d1e',
  card: '#1e2124',
  cardAlt: '#1e2124',
  border: '#2e3335',
  borderLight: '#252829',
  text: '#ECEDEE',
  textSub: '#9BA1A6',
  textMuted: '#555555',
  tint: '#3ea8c7',
  segmentBg: '#252829',
  segmentActiveBg: '#363a3c',
  segmentActiveShadowOpacity: 0,
  toggleActiveBg: '#ECEDEE',
  toggleActiveText: '#151718',
  gridline: '#222527',
  gridlineEdge: '#2e3335',
  cellEmpty: '#2a2d2f',
  drawerBg: '#1e2124',
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

export function useTheme(): AppTheme {
  const scheme = useAppColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
