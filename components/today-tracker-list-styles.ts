// Styles shared by TodayTrackerList. Factored out so the component file can
// stay focused on animation/layout logic.
import { StyleSheet } from 'react-native';

import { Space } from '@/constants/tokens';
import { AppTheme } from '@/hooks/use-theme';

export function makeTodayTrackerListStyles(_c: AppTheme) {
  return StyleSheet.create({
    list: { paddingHorizontal: Space.lg, paddingVertical: Space.md },
    separator: { height: Space.base },
  });
}

export type TodayTrackerListStyles = ReturnType<typeof makeTodayTrackerListStyles>;
