import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';

const ROUTE_ICONS: Record<string, React.ComponentProps<typeof IconSymbol>['name']> = {
  index: 'list.bullet',
  today: 'calendar',
  graph: 'chart.bar.fill',
};

const ROUTE_LABELS: Record<string, string> = {
  index: 'Trackers',
  today: 'Today',
  graph: 'Graph',
};

// Routes rendered inside the main pill
const PILL_ROUTES = new Set(['index', 'today', 'graph']);

const PILL_PADDING = 5;
const ITEM_GAP = 4;
const ITEM_HEIGHT = 48;
const PILL_HEIGHT = ITEM_HEIGHT + PILL_PADDING * 2;

// Total height from the bottom of the screen to the top of the pill (pill + margins).
// Use this as paddingBottom on scroll containers so content clears the tab bar.
export const TAB_BAR_HEIGHT = PILL_HEIGHT + 28 + 12;

function calcItemWidth(containerWidth: number, tabCount: number): number {
  return (containerWidth - PILL_PADDING * 2 - ITEM_GAP * (tabCount - 1)) / tabCount;
}

function calcSliderX(index: number, iw: number): number {
  return PILL_PADDING + index * (iw + ITEM_GAP);
}

// ── Tab item ──────────────────────────────────────────────────────────────────

function TabItem({ routeName, isFocused, onPress, c }: {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  c: AppTheme;
}) {
  const iconName = ROUTE_ICONS[routeName];
  const label = ROUTE_LABELS[routeName];
  const color = isFocused ? c.background : c.text;

  return (
    <Pressable style={styles.tabItem} onPress={onPress}>
      {iconName && <IconSymbol size={18} name={iconName} color={color} />}
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </Pressable>
  );
}

// ── CustomTabBar ──────────────────────────────────────────────────────────────

type CustomTabBarProps = BottomTabBarProps & {
  onSettingsPress?: () => void;
  settingsActive?: boolean;
};

export function CustomTabBar({ state, navigation, onSettingsPress, settingsActive = false }: CustomTabBarProps) {
  const c = useTheme();
  const animationsEnabled = useAnimationsEnabled();
  const glassAvailable = isGlassEffectAPIAvailable();

  const pillRoutes = state.routes.filter((r) => PILL_ROUTES.has(r.name));
  const tabCount = pillRoutes.length;
  const pillActiveIndex = settingsActive ? -1 : state.index;

  const [containerWidth, setContainerWidth] = useState(0);
  const iw = containerWidth > 0 ? calcItemWidth(containerWidth, tabCount) : 0;

  const slideAnim = useRef(new Animated.Value(0)).current;
  // Tracks whether the pill has been measured at least once so the first
  // layout jump sets the position instantly instead of animating from 0.
  const hasLaidOut = useRef(false);

  useEffect(() => {
    if (iw <= 0) return;
    const toValue = calcSliderX(Math.max(0, pillActiveIndex), iw);
    if (!hasLaidOut.current) {
      // First layout — snap to position without animation.
      hasLaidOut.current = true;
      slideAnim.setValue(toValue);
      return;
    }
    if (pillActiveIndex < 0) return;
    if (!animationsEnabled) {
      slideAnim.setValue(toValue);
      return;
    }
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      stiffness: 260,
      damping: 26,
      mass: 0.8,
    }).start();
  }, [iw, pillActiveIndex, animationsEnabled, slideAnim]);

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function navigateTo(route: (typeof state.routes)[number]) {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const isFocused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  const PillContainer = glassAvailable ? GlassView : View;
  const pillExtraProps = glassAvailable
    ? { glassEffectStyle: 'regular' as const, colorScheme: 'auto' as const, isInteractive: true }
    : {};

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      {/* Gear circle — opens the settings drawer */}
      <Pressable
        style={[styles.gearCircle, { backgroundColor: c.card }]}
        onPress={onSettingsPress}
      >
        <IconSymbol
          size={20}
          name="gearshape.fill"
          color={settingsActive ? c.tint : c.text}
        />
      </Pressable>

      {/* Main pill */}
      <PillContainer
        {...pillExtraProps}
        onLayout={onLayout}
        style={[styles.pill, !glassAvailable && { backgroundColor: c.card }]}
      >
        {/* Sliding indicator */}
        {iw > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slider,
              {
                width: iw,
                backgroundColor: c.text,
                opacity: settingsActive ? 0 : 1,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        )}

        {pillRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key;
          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={() => navigateTo(route)}
              c={c}
            />
          );
        })}
      </PillContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 28,
    paddingTop: 12,
    gap: 8,
  },
  gearCircle: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: PILL_PADDING,
    gap: ITEM_GAP,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  slider: {
    position: 'absolute',
    top: PILL_PADDING,
    left: 0,
    height: ITEM_HEIGHT,
    borderRadius: 999,
  },
  tabItem: {
    flex: 1,
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
