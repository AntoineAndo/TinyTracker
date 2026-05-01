// Lightweight placeholder surface used while a widget defers expensive work
// to a later frame (see `useDeferMount`). Matches the host card's elevated
// background so layout doesn't shift when the real content swaps in.

import { StyleProp, View, ViewStyle } from 'react-native';

import { Radius } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: Radius.xl },
        style,
      ]}
    />
  );
}
