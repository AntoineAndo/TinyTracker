import { useRef } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';

import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';

interface AnimatedButtonProps extends PressableProps {
  /** Scale target on press-in. Defaults to 0.95. */
  pressedScale?: number;
}

/**
 * A Pressable that springs down to `pressedScale` on press-in and bounces
 * back on press-out. Respects the global animations-enabled setting.
 *
 * The scale animation lives on a wrapping Animated.View so the Pressable
 * receives its style prop directly — this supports both plain styles and
 * the function-style `(state) => style` form that Pressable accepts.
 */
export function AnimatedButton({
  style,
  children,
  pressedScale = 0.95,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedButtonProps) {
  const animationsEnabled = useAnimationsEnabled();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn(e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) {
    if (animationsEnabled) {
      Animated.spring(scaleAnim, {
        toValue: pressedScale,
        useNativeDriver: true,
        tension: 1000,
        friction: 20,
      }).start();
    }
    onPressIn?.(e);
  }

  function handlePressOut(e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) {
    if (animationsEnabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 500,
        friction: 20,
      }).start();
    }
    onPressOut?.(e);
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable style={style} onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
