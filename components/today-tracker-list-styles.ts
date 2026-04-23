import { StyleSheet } from 'react-native';

import { AppTheme } from '@/hooks/use-theme';

export function makeTodayTrackerListStyles(c: AppTheme) {
  return StyleSheet.create({
    list: { paddingHorizontal: 16, paddingVertical: 8 },
    separator: { height: 10 },
  });
}

export type TodayTrackerListStyles = ReturnType<typeof makeTodayTrackerListStyles>;
