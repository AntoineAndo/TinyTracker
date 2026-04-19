import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useTheme } from '@/hooks/use-theme';

const SPRING = { useNativeDriver: true, damping: 30, stiffness: 1000 } as const;
const SLIDE_DURATION = 300;

export function StreakBadge({ streak, fontSize = 13 }: { streak: number; fontSize?: number }) {
  const c = useTheme();
  const animationsEnabled = useAnimationsEnabled();
  const slideOffset = Math.ceil(fontSize * 1.4);
  const prevStreak = useRef(streak);

  const [displayStreak, setDisplayStreak] = useState(streak);
  const scaleAnim = useRef(new Animated.Value(streak > 0 ? 1 : 0)).current;
  const flameScaleAnim = useRef(new Animated.Value(1)).current;

  const [shownNumber, setShownNumber] = useState(streak);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prev = prevStreak.current;
    prevStreak.current = streak;

    if (prev === 0 && streak > 0) {
      setDisplayStreak(streak);
      setShownNumber(streak);
      if (animationsEnabled) {
        scaleAnim.setValue(0);
        Animated.spring(scaleAnim, { toValue: 1, ...SPRING }).start();
      } else {
        scaleAnim.setValue(1);
      }
    } else if (streak > 0 && prev !== streak) {
      setDisplayStreak(streak);
      if (animationsEnabled) {
        flameScaleAnim.setValue(1.4);
        Animated.spring(flameScaleAnim, { toValue: 1, ...SPRING }).start();
        setNextNumber(streak);
        slideAnim.setValue(0);
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: SLIDE_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setShownNumber(streak);
          setNextNumber(null);
        });
      } else {
        setShownNumber(streak);
      }
    }
  }, [streak, animationsEnabled]);

  if (displayStreak === 0) return null;

  const textStyle = { fontSize, fontWeight: '600' as const, color: c.textSub };

  const currentTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -slideOffset] });
  const nextTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [slideOffset, 0] });
  const currentOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const nextOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.row}>
        <Animated.Text style={[textStyle, { transform: [{ scale: flameScaleAnim }] }]}>🔥</Animated.Text>
        <View style={styles.numClip}>
          {nextNumber !== null ? (
            <>
              <Animated.Text style={[textStyle, { transform: [{ translateX: currentTranslate }], opacity: currentOpacity }]}>
                {shownNumber}
              </Animated.Text>
              <Animated.Text style={[textStyle, { position: 'absolute', top: 0, left: 0, transform: [{ translateX: nextTranslate }], opacity: nextOpacity }]}>
                {nextNumber}
              </Animated.Text>
            </>
          ) : (
            <Animated.Text style={textStyle}>{shownNumber}</Animated.Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  numClip: { flexShrink: 0, zIndex: -1},
});
