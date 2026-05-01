// Compact picker control for choosing a tracker. Renders as a colored chip
// trigger ("● 🧠 Mood ▼"); tapping opens a modal sheet listing every tracker
// for selection. Used by the Overlay view to switch the two compared series.

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Border, Radius, Shadow, Space, Type, Weight } from '@/constants/tokens';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex, getTrackerColorRgba } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Tracker } from '@/lib/types';

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      paddingHorizontal: Space.base,
      paddingVertical: Space.md,
      borderRadius: Radius.md,
      borderWidth: Border.strong,
      backgroundColor: c.card,
      flex: 1,
    },
    triggerIcon: { fontSize: 14 },
    triggerLabel: { ...Type.caption, color: c.text, flex: 1 },
    chevron: { ...Type.caption, color: c.textMuted },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingTop: Space.lg,
      paddingBottom: Space['2xl'],
      maxHeight: '70%',
      ...Shadow.popover,
    },
    sheetTitle: {
      ...Type.label,
      color: c.text,
      paddingHorizontal: Space.xl,
      paddingBottom: Space.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.base,
      paddingHorizontal: Space.xl,
      paddingVertical: Space.base,
    },
    rowSelected: { backgroundColor: c.surface },
    rowDot: { width: 14, height: 14, borderRadius: 7 },
    rowIcon: { fontSize: 18 },
    rowLabel: { ...Type.body, color: c.text, flex: 1, fontWeight: Weight.semibold },
  });
}

interface TrackerSelectProps {
  trackers: Tracker[];
  value: string;
  onChange: (id: string) => void;
}

export const TrackerSelect = React.memo(function TrackerSelect({
  trackers, value, onChange,
}: TrackerSelectProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);

  const selected = trackers.find((t) => t.id === value) ?? trackers[0];
  const accent = selected ? getTrackerColorHex(selected.color) : c.border;

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handlePick = useCallback((id: string) => {
    onChange(id);
    setOpen(false);
  }, [onChange]);

  if (!selected) return null;

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[styles.trigger, { borderColor: accent }]}
        accessibilityRole="button"
        accessibilityLabel={`Pick tracker (currently ${selected.name})`}>
        <Text style={styles.triggerIcon}>{getTrackerIcon(selected.icon)}</Text>
        <Text style={styles.triggerLabel} numberOfLines={1}>{selected.name}</Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose tracker</Text>
            <FlatList
              data={trackers}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => {
                const isSelected = item.id === value;
                const dotBg = getTrackerColorRgba(item.color, 0.18);
                const dotBorder = getTrackerColorHex(item.color);
                return (
                  <Pressable
                    onPress={() => handlePick(item.id)}
                    style={[styles.row, isSelected && styles.rowSelected]}>
                    <View style={[styles.rowDot, { backgroundColor: dotBg, borderWidth: Border.strong, borderColor: dotBorder }]} />
                    <Text style={styles.rowIcon}>{getTrackerIcon(item.icon)}</Text>
                    <Text style={styles.rowLabel} numberOfLines={1}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});
