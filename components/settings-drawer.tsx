// Bottom-sheet settings drawer with two swipable pages: main settings list
// and an Appearance sub-page (theme + animations). Opens from the gear button
// in the custom tab bar.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Border, FontFamily, Motion, Radius, Shadow, Size, Space, Type, Weight } from '@/constants/tokens';
import { AnimationSetting, ThemeSetting, useSettings } from '@/context/settings-context';
import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';
import { sendTestNotification } from '@/hooks/use-notification-scheduler';
import { AppTheme, useTheme } from '@/hooks/use-theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const ANIMATION_OPTIONS: { value: AnimationSetting; label: string; description: string }[] = [
  { value: 'off',    label: 'Off',    description: 'Animations are always disabled' },
  { value: 'system', label: 'System', description: 'Follow the device accessibility setting' },
  { value: 'on',     label: 'On',     description: 'Animations are always enabled' },
];

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'light',  label: 'Light'  },
  { value: 'system', label: 'System' },
  { value: 'dark',   label: 'Dark'   },
];

const DAY_START_MIN = -12;
const DAY_START_MAX = 11;

// Pull-to-dismiss gesture thresholds
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.5;
const PAN_SPRING = { useNativeDriver: true, stiffness: 400, damping: 35 } as const;

// Soft icon background colors — work in both light and dark themes
const IB = {
  purple: 'rgba(139,92,246,0.15)',
  coral:  'rgba(249,115,22,0.15)',
  mint:   'rgba(16,185,129,0.15)',
  sky:    'rgba(14,165,233,0.15)',
  gold:   'rgba(245,158,11,0.15)',
  rose:   'rgba(244,63,94,0.15)',
};

function formatHour(h: number): string {
  if (h === 0) return 'Midnight';
  if (h === 12) return '12:00 PM';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

function formatDayStartHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  if (hour === 0) return 'Midnight';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

// ── DarkPreview — mini phone mockup for theme selection ───────────────────────

function DarkPreview({ mode }: { mode: ThemeSetting }) {
  const c = useTheme();
  // Background colours per mode
  const lightBg = '#F5F1EA';
  const darkBg  = '#12121C';
  const lightCard = '#FFFFFF';
  const darkCard  = '#1C1C2B';
  const lightText = '#191714';
  const darkText  = '#F5F1EA';

  const bg   = mode === 'light' ? lightBg   : mode === 'dark' ? darkBg   : undefined;
  const card = mode === 'light' ? lightCard  : mode === 'dark' ? darkCard  : lightCard;
  const text = mode === 'light' ? lightText  : mode === 'dark' ? darkText  : lightText;

  return (
    <View style={{ width: 52, height: 66, borderRadius: 11, overflow: 'hidden', borderWidth: Border.hairline, borderColor: c.border }}>
      {/* Background — split for system */}
      {mode === 'system' ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: lightBg }} />
          <View style={{ flex: 1, backgroundColor: darkBg }} />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: bg }} />
      )}
      {/* Decorative card elements */}
      <View style={{ position: 'absolute', top: 7, left: 7, right: 7, height: 11, borderRadius: 3, backgroundColor: card }} />
      <View style={{ position: 'absolute', top: 24, left: 7, width: 20, height: 3, borderRadius: 2, backgroundColor: text, opacity: 0.7 }} />
      <View style={{ position: 'absolute', top: 32, left: 7, right: 7, height: 15, borderRadius: 3, backgroundColor: card }} />
      <View style={{ position: 'absolute', top: 52, left: 7, right: 7, height: 8, borderRadius: 3, backgroundColor: card }} />
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useTheme();
  const childArray = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ marginTop: Space.section, paddingHorizontal: Space.xl }}>
      <Text style={{
        ...Type.overline, fontSize: 11, color: c.textSub,
        paddingHorizontal: Space.md, paddingBottom: Space.md,
      }}>
        {label}
      </Text>
      <View style={{
        backgroundColor: c.card, borderRadius: Radius.xl, overflow: 'hidden',
        ...Shadow.card,
      }}>
        {childArray.map((child, i) => (
          // marginLeft indents the divider past the icon column (iconBgSm 32
          // + horizontal padding 14 + gap 12 = 58) so it aligns under titles.
          <React.Fragment key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 58 }} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

type SettingRowProps = {
  icon: string;
  iconBg: string;
  title: string;
  sub?: string;
  children?: React.ReactNode;
};

function SettingRow({ icon, iconBg, title, sub, children }: SettingRowProps) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.base, paddingHorizontal: Space.lg, paddingVertical: Space.base }}>
      <View style={{ width: Size.iconBgSm, height: Size.iconBgSm, borderRadius: Radius.sm, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Type.bodyMd, color: c.text }}>{title}</Text>
        {sub && <Text style={{ fontSize: 11, color: c.textSub, marginTop: 1, lineHeight: 16 }}>{sub}</Text>}
      </View>
      {children && <View style={{ flexShrink: 0 }}>{children}</View>}
    </View>
  );
}

type LinkRowProps = {
  icon?: string;
  iconBg?: string;
  title: string;
  detail?: string;
  danger?: boolean;
  onPress: () => void;
};

function LinkRow({ icon, iconBg, title, detail, danger, onPress }: LinkRowProps) {
  const c = useTheme();
  return (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', gap: Space.base, paddingHorizontal: Space.lg, paddingVertical: Space.base }}
      onPress={onPress}
    >
      {icon && iconBg && (
        <View style={{ width: Size.iconBgSm, height: Size.iconBgSm, borderRadius: Radius.sm, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
      )}
      <Text style={{ ...Type.bodyMd, flex: 1, color: danger ? '#ef4444' : c.text }}>{title}</Text>
      {detail && <Text style={{ fontSize: 13, color: c.textSub, marginRight: Space.xs }}>{detail}</Text>}
      <Text style={{ fontSize: 16, color: c.textMuted, lineHeight: 20 }}>›</Text>
    </Pressable>
  );
}

function CompactStepper({ onDecrement, onIncrement, label }: {
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.segmentBg, borderRadius: Radius.pill, padding: 2, gap: 2 }}>
      <Pressable
        style={{ width: 28, height: 28, borderRadius: Radius.pill, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
        onPress={onDecrement}
      >
        <Text style={{ fontSize: 16, fontWeight: Weight.bold, color: c.text, lineHeight: 20 }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 56, textAlign: 'center', fontSize: 13, fontWeight: Weight.bold, color: c.text }}>{label}</Text>
      <Pressable
        style={{ width: 28, height: 28, borderRadius: Radius.pill, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
        onPress={onIncrement}
      >
        <Text style={{ fontSize: 16, fontWeight: Weight.bold, color: c.text, lineHeight: 20 }}>+</Text>
      </Pressable>
    </View>
  );
}

// ── Styles (sheet chrome only) ────────────────────────────────────────────────

function makeStyles(c: AppTheme, screenHeight: number) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    // Drawer top corners are larger than the standard card (xl=20) so the
    // sheet reads as a distinct surface floating above the rest of the app.
    sheet: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      height: screenHeight * 0.88,
    },
    handle: {
      alignItems: 'center',
      paddingTop: Space.lg,
      paddingBottom: Space.md,
      flexShrink: 0,
    },
    handleBar: {
      width: 40, height: 4,
      borderRadius: Radius.pill,
      backgroundColor: c.border,
    },
    pagesContainer: {
      flex: 1,
      overflow: 'hidden',
    },
    page: {
      ...StyleSheet.absoluteFillObject,
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.xl,
      paddingTop: Space.md,
      paddingBottom: Space.lg,
      flexShrink: 0,
    },
    pageTitle: { fontFamily: FontFamily.displaySerif, fontSize: 28, letterSpacing: -0.3, color: c.text },
    iconBtn: {
      width: Size.iconBgSm, height: Size.iconBgSm, borderRadius: Radius.pill,
      backgroundColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    iconBtnText: { fontSize: 16, color: c.textSub, lineHeight: 20 },
    backBtnText: { fontSize: 20, color: c.textSub, lineHeight: 24, marginLeft: -1 },
    onDeviceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.base,
      backgroundColor: c.card,
      borderRadius: Radius.xl,
      padding: Space.lg,
      borderWidth: Border.hairline,
      borderColor: c.border,
      marginHorizontal: Space.xl,
      marginBottom: Space.xs,
    },
    onDeviceIcon: {
      width: Size.control, height: Size.control, borderRadius: Radius.md,
      backgroundColor: 'rgba(34,197,94,0.15)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    // Appearance sub-page
    appearanceSection: { marginTop: Space.md, paddingHorizontal: Space.xl },
    appearanceSectionLater: { marginTop: Space.section, paddingHorizontal: Space.xl },
    appearanceSectionLabel: {
      ...Type.overline, fontSize: 11, color: c.textSub,
      paddingHorizontal: Space.md, paddingBottom: Space.md,
    },
    themeCard: {
      backgroundColor: c.card, borderRadius: Radius.xl, padding: Space.base,
      flexDirection: 'row', gap: Space.md,
      ...Shadow.card,
    },
    themeBtn: {
      flex: 1, borderRadius: Radius.md, padding: Space.base,
      alignItems: 'center', gap: Space.md,
    },
    themeBtnActive: { backgroundColor: c.segmentBg },
    themeBtnLabel: { fontSize: 12, fontWeight: Weight.semibold, color: c.text },
    segmentCard: {
      backgroundColor: c.card, borderRadius: Radius.xl, padding: Space.lg, gap: Space.base,
      ...Shadow.card,
    },
    segmentRow: {
      flexDirection: 'row', backgroundColor: c.segmentBg,
      borderRadius: Radius.md, padding: 3, gap: 2,
    },
    segment: { flex: 1, paddingVertical: Space.md, borderRadius: Radius.sm, alignItems: 'center' },
    segmentActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000', shadowOpacity: c.segmentActiveShadowOpacity,
      shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    segmentText: { fontSize: 14, fontWeight: Weight.semibold, color: c.textSub },
    segmentTextActive: { color: c.text },
    segmentDesc: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    versionFooter: {
      textAlign: 'center', color: c.textMuted,
      fontSize: 11, marginTop: Space.section, marginBottom: Space.xs,
    },
  });
}

// ── NameField — inline text input with a focus-triggered Done button ──────────

// Separate component so focus state doesn't cause the whole drawer to re-render.
function NameField() {
  const c = useTheme();
  const { userName, setUserName } = useSettings();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  function handleDone() {
    inputRef.current?.blur();
  }

  return (
    <SettingRow icon="🙂" iconBg={IB.gold} title="Your name">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <TextInput
          ref={inputRef}
          value={userName}
          onChangeText={setUserName}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={handleDone}
          placeholder="Name"
          placeholderTextColor={c.textMuted}
          style={{ ...Type.bodyMd, color: c.text, textAlign: 'right', minWidth: 80 }}
          maxLength={30}
          returnKeyType="done"
        />
        {focused && (
          <Pressable
            onPress={handleDone}
            style={{
              backgroundColor: c.tint,
              borderRadius: Radius.pill,
              paddingHorizontal: Space.base,
              paddingVertical: Space.xs + 1,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: Weight.bold, color: '#fff' }}>Done</Text>
          </Pressable>
        )}
      </View>
    </SettingRow>
  );
}

// ── SettingsDrawer ────────────────────────────────────────────────────────────

type Props = { visible: boolean; onClose: () => void };

export function SettingsDrawer({ visible, onClose }: Props) {
  const c = useTheme();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c, screenHeight), [c, screenHeight]);
  const animationsEnabled = useAnimationsEnabled();
  const router = useRouter();

  const {
    animations, setAnimations,
    theme, setTheme,
    dayStartHour, setDayStartHour,
    reminderEnabled, setReminderEnabled,
    reminderHour, setReminderHour,
    graphShowValues, setGraphShowValues,
  } = useSettings();

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  const pageAnim = useRef(new Animated.Value(0)).current;

  // panY tracks the downward drag offset so the sheet follows the user's finger.
  // It adds on top of slideAnim so open/close animations and the drag compose cleanly.
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    // Only claim the responder once movement intent is clear — keeps taps on the handle free.
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 2,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) panY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > DISMISS_DISTANCE || gs.vy > DISMISS_VELOCITY) {
        // Leave panY at the release position so the sheet exits from where the finger lifted.
        // panY is zeroed in the visible=true branch on next open.
        onClose();
      } else {
        Animated.spring(panY, { toValue: 0, ...PAN_SPRING }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(panY, { toValue: 0, ...PAN_SPRING }).start();
    },
  })).current;
  const mainX = pageAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -screenWidth] });
  const appearanceX = pageAnim.interpolate({ inputRange: [0, 1], outputRange: [screenWidth, 0] });

  function goAppearance() {
    if (!animationsEnabled) { pageAnim.setValue(1); return; }
    Animated.spring(pageAnim, { toValue: 1, useNativeDriver: true, stiffness: 320, damping: 32 }).start();
  }

  function goMain() {
    if (!animationsEnabled) { pageAnim.setValue(0); return; }
    Animated.spring(pageAnim, { toValue: 0, useNativeDriver: true, stiffness: 320, damping: 32 }).start();
  }

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      panY.setValue(0);
      if (!animationsEnabled) {
        slideAnim.setValue(0);
        backdropAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, stiffness: 280, damping: 32, mass: 0.9 }),
          Animated.timing(backdropAnim, { toValue: 1, duration: Motion.base, useNativeDriver: true }),
        ]).start();
      }
    } else {
      // Cancel any in-flight spring-back so it doesn't compose with the slide-out.
      panY.stopAnimation();
      const reset = setTimeout(() => pageAnim.setValue(0), 320);
      if (!animationsEnabled) {
        panY.setValue(0);
        slideAnim.setValue(screenHeight);
        backdropAnim.setValue(0);
        setModalVisible(false);
        clearTimeout(reset);
        pageAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: screenHeight, duration: Motion.slow, useNativeDriver: true }),
          Animated.timing(backdropAnim, { toValue: 0, duration: Motion.base, useNativeDriver: true }),
        ]).start(() => { panY.setValue(0); setModalVisible(false); });
      }
      return () => clearTimeout(reset);
    }
  }, [visible, animationsEnabled, slideAnim, backdropAnim, pageAnim, panY]);

  const themeLabel = THEME_OPTIONS.find((o) => o.value === theme)?.label ?? '';

  return (
    <Modal visible={modalVisible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(slideAnim, panY) }] }]}>
        <View style={styles.handle} {...panResponder.panHandlers}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.pagesContainer}>

          {/* ── Main page ── */}
          <Animated.View style={[styles.page, { transform: [{ translateX: mainX }] }]}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Settings</Text>
              <Pressable style={styles.iconBtn} onPress={onClose}>
                <Text style={styles.iconBtnText}>✕</Text>
              </Pressable>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Space['2xl'] }}>
              {/* On-device only banner */}
              <View style={styles.onDeviceCard}>
                <View style={styles.onDeviceIcon}>
                  <Text style={{ fontSize: 20 }}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...Type.bodyMd, fontWeight: Weight.bold, color: c.text }}>On-device only</Text>
                  <Text style={{ fontSize: 12, color: c.textSub, marginTop: 2, lineHeight: 17 }}>
                    No account, no cloud. Your data stays on this phone.
                  </Text>
                </View>
              </View>

              <SettingsGroup label="Appearance">
                <LinkRow
                  icon="🎨" iconBg={IB.purple}
                  title="Theme & animations"
                  detail={themeLabel}
                  onPress={goAppearance}
                />
              </SettingsGroup>

              <SettingsGroup label="General">
                <SettingRow
                  icon="🌙" iconBg={IB.purple}
                  title="Day starts at"
                  sub="Night-owl friendly: late logs count toward the previous day"
                >
                  <CompactStepper
                    label={formatDayStartHour(dayStartHour)}
                    onDecrement={() => setDayStartHour(dayStartHour <= DAY_START_MIN ? DAY_START_MAX : dayStartHour - 1)}
                    onIncrement={() => setDayStartHour(dayStartHour >= DAY_START_MAX ? DAY_START_MIN : dayStartHour + 1)}
                  />
                </SettingRow>
              </SettingsGroup>

              <SettingsGroup label="Notifications">
                <SettingRow icon="🔔" iconBg={IB.rose} title="Daily reminder" sub="Get a nudge to fill in your trackers">
                  <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
                </SettingRow>
                {reminderEnabled && (
                  <SettingRow icon="🕗" iconBg={IB.coral} title="Reminder time">
                    <CompactStepper
                      label={formatHour(reminderHour)}
                      onDecrement={() => setReminderHour((reminderHour - 1 + 24) % 24)}
                      onIncrement={() => setReminderHour((reminderHour + 1) % 24)}
                    />
                  </SettingRow>
                )}
                {reminderEnabled && (
                  <LinkRow icon="📤" iconBg={IB.sky} title="Send test notification" onPress={sendTestNotification} />
                )}
              </SettingsGroup>

              <SettingsGroup label="Graph">
                <SettingRow icon="📊" iconBg={IB.mint} title="Show values" sub="Display numeric values on the graph">
                  <Switch value={graphShowValues} onValueChange={setGraphShowValues} />
                </SettingRow>
              </SettingsGroup>

              <SettingsGroup label="Data">
                <LinkRow icon="📤" iconBg={IB.sky}  title="Export data" detail="CSV" onPress={() => {}} />
                <LinkRow icon="📥" iconBg={IB.mint} title="Import backup"             onPress={() => {}} />
              </SettingsGroup>

              <SettingsGroup label="About">
                <LinkRow title="Help & FAQ"       onPress={() => {}} />
                <LinkRow title="Privacy policy"   onPress={() => {}} />
                <LinkRow title="Rate Track-it"    onPress={() => {}} />
              </SettingsGroup>

              <SettingsGroup label="Profile">
                <NameField />
                <LinkRow
                  icon="🧑" iconBg={IB.gold}
                  title="Character"
                  onPress={() => { onClose(); router.push('/character-builder'); }}
                />
              </SettingsGroup>

              <SettingsGroup label="Debug">
                <LinkRow
                  icon="✨" iconBg={IB.sky}
                  title="Streak animation test"
                  onPress={() => { onClose(); router.push('/streak-test'); }}
                />
              </SettingsGroup>

              {/* Version footer */}
              <Text style={styles.versionFooter}>Track-it · v1.0.0</Text>
            </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>

          {/* ── Appearance sub-page ── */}
          <Animated.View style={[styles.page, { transform: [{ translateX: appearanceX }] }]}>
            <View style={styles.pageHeader}>
              <Pressable style={styles.iconBtn} onPress={goMain}>
                <Text style={styles.backBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.pageTitle}>Appearance</Text>
              <View style={{ width: Size.iconBgSm }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space['2xl'] }}>
              {/* Theme — visual preview cards */}
              <View style={styles.appearanceSection}>
                <Text style={styles.appearanceSectionLabel}>Theme</Text>
                <View style={styles.themeCard}>
                  {THEME_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.themeBtn, theme === opt.value && styles.themeBtnActive]}
                      onPress={() => setTheme(opt.value)}
                    >
                      <DarkPreview mode={opt.value} />
                      <Text style={styles.themeBtnLabel}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Animations */}
              <View style={styles.appearanceSectionLater}>
                <Text style={styles.appearanceSectionLabel}>Animations</Text>
                <View style={styles.segmentCard}>
                  <View style={styles.segmentRow}>
                    {ANIMATION_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.segment, animations === opt.value && styles.segmentActive]}
                        onPress={() => setAnimations(opt.value)}>
                        <Text style={[styles.segmentText, animations === opt.value && styles.segmentTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.segmentDesc}>
                    {ANIMATION_OPTIONS.find((o) => o.value === animations)?.description}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </Animated.View>

        </View>
      </Animated.View>
    </Modal>
  );
}
