// Animated segmented control: a sliding pill backs the active option so tab
// changes feel continuous rather than snapping between colored states.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space, Type, Weight } from '@/constants/tokens';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { useTheme } from '@/hooks/use-theme';

const PADDING = 3;
const GAP = 2;

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
};

export function SegmentControl<T extends string>({ options, value, onChange, label }: Props<T>) {
  const c = useTheme();
  const animationsEnabled = useAnimationsEnabled();

  const activeIndex = options.findIndex((o) => o.value === value);
  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isFirstLayout = useRef(true);

  const n = options.length;
  const pillWidth = containerWidth > 0 ? (containerWidth - PADDING * 2 - GAP * (n - 1)) / n : 0;
  const pillX = PADDING + activeIndex * (pillWidth + GAP);

  useEffect(() => {
    if (pillWidth === 0) return;
    if (isFirstLayout.current) {
      slideAnim.setValue(pillX);
      isFirstLayout.current = false;
      return;
    }
    if (animationsEnabled) {
      Animated.spring(slideAnim, {
        toValue: pillX,
        useNativeDriver: true,
        stiffness: 320,
        damping: 28,
        mass: 0.7,
      }).start();
    } else {
      slideAnim.setValue(pillX);
    }
  }, [pillX, pillWidth, animationsEnabled]);

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: c.textSub }]}>{label}</Text> : null}
      <View
        style={[styles.track, { backgroundColor: c.segmentBg }]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {pillWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: pillWidth,
                backgroundColor: c.segmentActiveBg,
                shadowOpacity: c.segmentActiveShadowOpacity,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        )}
        {options.map((opt) => (
          <Pressable key={opt.value} style={styles.segment} onPress={() => onChange(opt.value)}>
            <Text
              style={[
                styles.segmentText,
                { color: value === opt.value ? c.text : c.textSub },
                value === opt.value && styles.segmentTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Space.md },
  label: { ...Type.fieldLabel },
  track: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: PADDING,
    gap: GAP,
  },
  pill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    borderRadius: Radius.sm,
    shadowColor: '#000',
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: { fontSize: 14, fontWeight: Weight.medium },
  segmentTextActive: { fontWeight: Weight.semibold },
});
