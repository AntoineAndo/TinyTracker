import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { AppTheme, useTheme } from '@/hooks/use-theme';
import { getTrackerColorHex } from '@/lib/tracker-colors';
import { getTrackerIcon } from '@/lib/tracker-icons';
import { Entry, Tracker } from '@/lib/types';
import { toNumericValue } from '@/lib/utils';

const SHEET_TRANSLATE_CLOSED = 600;

function makeDrawerStyles(c: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: c.drawerBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 40,
      gap: 16,
    },
    dragZone: {
      paddingBottom: 4,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 4,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.text, textAlign: 'center' },
    boolRow: { flexDirection: 'row', gap: 12 },
    boolBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 12,
      borderWidth: 2, borderColor: c.border, alignItems: 'center',
    },
    boolBtnText: { fontSize: 16, fontWeight: '600', color: c.textSub },
    countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    countBtn: {
      minWidth: 56, paddingHorizontal: 12, paddingVertical: 14,
      borderRadius: 12, borderWidth: 2, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    countBtnText: { fontSize: 18, fontWeight: '700', color: c.textSub },
    countBtnTextActive: { color: '#fff' },
    rangeRow: { flexDirection: 'row', gap: 10 },
    rangeBtn: {
      flex: 1, aspectRatio: 1, borderRadius: 12,
      borderWidth: 2, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    rangeBtnText: { fontSize: 18, fontWeight: '700', color: c.textSub },
    rangeBtnTextActive: { color: '#fff' },
    logRow: { alignItems: 'center' },
    logInput: {
      width: 160, borderWidth: 2, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 24, fontWeight: '700', textAlign: 'center',
    },
    saveBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    deleteBtn: {
      borderRadius: 10, paddingVertical: 9, alignItems: 'center',
      borderWidth: 1, borderColor: '#fca5a5', alignSelf: 'center',
      paddingHorizontal: 20,
    },
    deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },
  });
}

interface EditEntryDrawerProps {
  tracker: Tracker;
  entry: Entry;
  /** Override the header title. Defaults to the tracker icon + name. */
  title?: string;
  hideDelete?: boolean;
  onSave: (value: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditEntryDrawer({ tracker, entry, title, hideDelete, onSave, onDelete, onClose }: EditEntryDrawerProps) {
  const c = useTheme();
  const drawerStyles = useMemo(() => makeDrawerStyles(c), [c]);

  const colorHex = getTrackerColorHex(tracker.color);
  const target = tracker.target ?? 1;
  const initialNum = toNumericValue(entry.value);
  const [selected, setSelected] = useState<number>(initialNum);

  const animationsEnabled = useAnimationsEnabled();
  const translateY = useRef(new Animated.Value(SHEET_TRANSLATE_CLOSED)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animationsEnabled) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
    }
  }, []);

  function close() {
    if (animationsEnabled) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_TRANSLATE_CLOSED, duration: 260,
          useNativeDriver: true, easing: Easing.in(Easing.ease),
        }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onClose());
    } else {
      onClose();
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
      onPanResponderMove: (_, { dy }) => { if (dy > 0) translateY.setValue(dy); },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          close();
        } else if (animationsEnabled) {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        } else {
          translateY.setValue(0);
        }
      },
    })
  ).current;

  function confirmDelete() {
    Alert.alert('Delete Entry', 'Remove this entry? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  const displayTitle = title ?? [getTrackerIcon(tracker.icon), tracker.name].filter(Boolean).join(' ');

  return (
    <Modal visible animationType="none" transparent onRequestClose={close}>
      <Animated.View style={[drawerStyles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[drawerStyles.sheet, { transform: [{ translateY }] }]}>
        <View {...panResponder.panHandlers} style={drawerStyles.dragZone}>
          <View style={drawerStyles.handle} />
          <Text style={drawerStyles.title}>{displayTitle}</Text>
        </View>

        {tracker.type === 'log' ? (
          <View style={drawerStyles.logRow}>
            <TextInput
              style={[drawerStyles.logInput, { borderColor: colorHex, color: colorHex }]}
              value={String(selected)}
              onChangeText={(t) => {
                const n = parseFloat(t);
                if (!isNaN(n)) setSelected(n);
                else if (t === '') setSelected(0);
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
        ) : tracker.type === 'boolean' ? (
          <View style={drawerStyles.boolRow}>
            {([1, 0] as const).map((v) => (
              <Pressable
                key={v}
                style={[drawerStyles.boolBtn, selected === v && { borderColor: colorHex, backgroundColor: colorHex + '18' }]}
                onPress={() => setSelected(v)}>
                <Text style={[drawerStyles.boolBtnText, selected === v && { color: colorHex }]}>
                  {v === 1 ? 'Yes' : 'No'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : tracker.type === 'count' ? (
          <View style={drawerStyles.countRow}>
            {Array.from({ length: target + 1 }, (_, i) => i).map((v) => (
              <Pressable
                key={v}
                style={[drawerStyles.countBtn, selected === v && { borderColor: colorHex, backgroundColor: colorHex }]}
                onPress={() => setSelected(v)}>
                <Text style={[drawerStyles.countBtnText, selected === v && drawerStyles.countBtnTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={drawerStyles.rangeRow}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Pressable
                key={v}
                style={[drawerStyles.rangeBtn, selected === v && { borderColor: colorHex, backgroundColor: colorHex }]}
                onPress={() => setSelected(v)}>
                <Text style={[drawerStyles.rangeBtnText, selected === v && drawerStyles.rangeBtnTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={[drawerStyles.saveBtn, { backgroundColor: colorHex }]} onPress={() => onSave(selected)}>
          <Text style={drawerStyles.saveBtnText}>Save Changes</Text>
        </Pressable>
        {!hideDelete && (
          <Pressable style={drawerStyles.deleteBtn} onPress={confirmDelete}>
            <Text style={drawerStyles.deleteBtnText}>Delete Entry</Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
}
