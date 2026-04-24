// Animated row wrapper that collapses height and fades opacity when exiting,
// with an optional spring rebound for sibling rows positioned below the exiting item.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { Motion } from '@/constants/tokens';

export type ReboundTrigger = { version: number; delay: number };

// Staggered delay (ms) for a sibling row at `stepsBelow` positions below the exiting row
export function reboundDelay(stepsBelow: number): number {
  return 60 + stepsBelow * 40;
}

const STIFFNESS = 280;
const DAMPING = 17;
const MASS = 0.7;

type Props = {
  children: ReactNode;
  exiting: boolean;
  onExited: () => void;
  animationsEnabled: boolean;
  rebound?: ReboundTrigger;
};

export function AnimatedExitRow({ children, exiting, onExited, animationsEnabled, rebound }: Props) {
  const measuredHeight = useRef<number | null>(null);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const springAnim = useRef(new Animated.Value(0)).current;
  const [fixedHeight, setFixedHeight] = useState(false);
  const exitStarted = useRef(false);
  const prevReboundVersion = useRef<number | undefined>(undefined);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (!exiting || exitStarted.current) return;
    exitStarted.current = true;
    if (!animationsEnabled || measuredHeight.current === null) {
      onExitedRef.current();
      return;
    }
    heightAnim.setValue(measuredHeight.current);
    setFixedHeight(true);
  }, [exiting, animationsEnabled, heightAnim]);

  useEffect(() => {
    if (!fixedHeight) return;
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: Motion.base, useNativeDriver: false }),
      Animated.timing(heightAnim, { toValue: 0, duration: Motion.slow, useNativeDriver: false }),
    ]).start(() => onExitedRef.current());
  }, [fixedHeight, heightAnim, opacityAnim]);

  useEffect(() => {
    if (!rebound || rebound.version === prevReboundVersion.current) return;
    prevReboundVersion.current = rebound.version;
    if (!animationsEnabled) return;
    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.timing(springAnim, { toValue: -9, duration: Motion.fast, useNativeDriver: true }),
        Animated.spring(springAnim, { toValue: 0, useNativeDriver: true, stiffness: STIFFNESS, damping: DAMPING, mass: MASS }),
      ]).start();
    }, rebound.delay);
    return () => clearTimeout(timeout);
  }, [rebound?.version, animationsEnabled, springAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: springAnim }] }}>
      <Animated.View
        style={fixedHeight ? { height: heightAnim, overflow: 'hidden', opacity: opacityAnim } : undefined}
        onLayout={(e) => {
          // Always update so the exit animation starts from the current height,
          // not the original height (which may be larger if inner rows have already collapsed).
          if (!exiting) {
            measuredHeight.current = e.nativeEvent.layout.height;
          }
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
