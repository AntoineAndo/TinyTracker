// Single-row presentation for a tracker: icon block, name + streak, and the
// right-aligned QuickAction control. Two variants: `card` (standalone with
// shadow) and `inset` (container-provided, e.g. inside a routine card).
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { CompletedValue, isCompleted, QuickAction } from '@/components/today-tracker-list-action';
import { Radius, Shadow, Size, Space, Type } from '@/constants/tokens';
import { isCheckboxControl } from '@/lib/tracker-utils';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Entry, Tracker } from '@/lib/types';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Space.base,
      paddingHorizontal: Space.base,
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      ...Shadow.card,
    },
    // Inset: no bg/shadow — parent row provides the container
    inset: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    done: { opacity: 0.5 },
    iconContainer: {
      width: Size.iconBg, height: Size.iconBg, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
      marginRight: Space.base, flexShrink: 0,
    },
    icon: { fontSize: 22 },
    nameContainer: {
      flex: 1, flexDirection: 'row' as const,
      alignItems: 'center' as const, gap: Space.sm, marginRight: Space.base,
    },
    name: { ...Type.body, flexShrink: 1 },
    nameDone: { color: '' }, // filled inline
    action: { alignItems: 'flex-end' as const },
  });
}

type Props = {
  tracker: Tracker;
  entry: Entry | undefined;
  streak?: number;
  showCompleted?: boolean;
  isPendingDismiss?: boolean;
  onSave: (value: number) => void;
  onComplete: () => void;
  onEdit?: () => void;
  /** 'card' renders a standalone white card with shadow (default, used in Today tab).
   *  'inset' renders just the content — parent provides the container bg/border. */
  variant?: 'card' | 'inset';
  style?: StyleProp<ViewStyle>;
  /** Per-routine target override for count trackers. Overrides tracker.target for completion and display. */
  routineTarget?: number;
};

export const TrackerEntryRow = memo(function TrackerEntryRow({
  tracker,
  entry,
  streak = 0,
  showCompleted = false,
  isPendingDismiss = false,
  onSave,
  onComplete,
  onEdit,
  variant = 'card',
  style,
  routineTarget,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const done = isCompleted(tracker, entry, routineTarget) && !isPendingDismiss;
  const iconBg = getTrackerColorRgba(tracker.color, 0.15);

  const content = (
    <>
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Text style={styles.icon}>{getTrackerIcon(tracker.icon)}</Text>
      </View>
      <View style={styles.nameContainer}>
        <Text
          style={[styles.name, { color: done ? c.textMuted : c.text }]}
          numberOfLines={1}
        >
          {tracker.name}
        </Text>
        {streak > 0 && <StreakBadge streak={streak} />}
      </View>
      <View style={styles.action}>
        {/* Checkbox trackers stay mounted so the checked state is always visible.
            Other trackers switch to CompletedValue when done (if showCompleted). */}
        {(() => {
          const showControl = isCheckboxControl(tracker, routineTarget) || !done;
          if (showControl) return <QuickAction tracker={tracker} entry={entry} onSave={onSave} onComplete={onComplete} routineTarget={routineTarget} />;
          if (done && showCompleted) return <CompletedValue tracker={tracker} entry={entry!} routineTarget={routineTarget} />;
          return null;
        })()}
      </View>
    </>
  );

  const containerStyle = [
    variant === 'card' ? styles.card : styles.inset,
    done && styles.done,
    style,
  ];

  if (done && showCompleted && onEdit) {
    return <Pressable style={containerStyle} onPress={onEdit}>{content}</Pressable>;
  }

  return <View style={containerStyle}>{content}</View>;
});
