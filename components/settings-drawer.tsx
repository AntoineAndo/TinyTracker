import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView,
  StyleSheet, Switch, Text, useWindowDimensions, View,
} from 'react-native';
import { useRouter } from 'expo-router';

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
    <View style={{ width: 52, height: 66, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
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
    <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: c.textSub,
        textTransform: 'uppercase', letterSpacing: 0.6,
        paddingHorizontal: 8, paddingBottom: 8,
      }}>
        {label}
      </Text>
      <View style={{
        backgroundColor: c.card, borderRadius: 18, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
      }}>
        {childArray.map((child, i) => (
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{title}</Text>
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}
      onPress={onPress}
    >
      {icon && iconBg && (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: danger ? '#ef4444' : c.text }}>{title}</Text>
      {detail && <Text style={{ fontSize: 13, color: c.textSub, marginRight: 4 }}>{detail}</Text>}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.segmentBg, borderRadius: 999, padding: 2, gap: 2 }}>
      <Pressable
        style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
        onPress={onDecrement}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, lineHeight: 20 }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 56, textAlign: 'center', fontSize: 13, fontWeight: '700', color: c.text }}>{label}</Text>
      <Pressable
        style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
        onPress={onIncrement}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, lineHeight: 20 }}>+</Text>
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
      paddingTop: 14,
      paddingBottom: 4,
      flexShrink: 0,
    },
    handleBar: {
      width: 40, height: 4,
      borderRadius: 999,
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
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      flexShrink: 0,
    },
    pageTitle: { fontSize: 24, fontWeight: '700', color: c.text },
    iconBtn: {
      width: 32, height: 32, borderRadius: 999,
      backgroundColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    iconBtnText: { fontSize: 16, color: c.textSub, lineHeight: 20 },
    backBtnText: { fontSize: 20, color: c.textSub, lineHeight: 24, marginLeft: -1 },
    onDeviceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginHorizontal: 20,
      marginBottom: 4,
    },
    onDeviceIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(34,197,94,0.15)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    // Appearance sub-page
    appearanceSection: { marginTop: 8, paddingHorizontal: 20 },
    appearanceSectionLater: { marginTop: 24, paddingHorizontal: 20 },
    appearanceSectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.textSub,
      textTransform: 'uppercase', letterSpacing: 0.6,
      paddingHorizontal: 8, paddingBottom: 8,
    },
    themeCard: {
      backgroundColor: c.card, borderRadius: 18, padding: 12,
      flexDirection: 'row', gap: 8,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    themeBtn: {
      flex: 1, borderRadius: 14, padding: 10,
      alignItems: 'center', gap: 8,
    },
    themeBtnActive: { backgroundColor: c.segmentBg },
    themeBtnLabel: { fontSize: 12, fontWeight: '600', color: c.text },
    segmentCard: {
      backgroundColor: c.card, borderRadius: 18, padding: 14, gap: 12,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    segmentRow: {
      flexDirection: 'row', backgroundColor: c.segmentBg,
      borderRadius: 10, padding: 3, gap: 2,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000', shadowOpacity: c.segmentActiveShadowOpacity,
      shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    segmentText: { fontSize: 14, fontWeight: '600', color: c.textSub },
    segmentTextActive: { color: c.text },
    segmentDesc: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    versionFooter: {
      textAlign: 'center', color: c.textMuted,
      fontSize: 11, marginTop: 28, marginBottom: 4,
    },
  });
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
      if (!animationsEnabled) {
        slideAnim.setValue(0);
        backdropAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, stiffness: 280, damping: 32, mass: 0.9 }),
          Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
      }
    } else {
      const reset = setTimeout(() => pageAnim.setValue(0), 320);
      if (!animationsEnabled) {
        slideAnim.setValue(screenHeight);
        backdropAnim.setValue(0);
        setModalVisible(false);
        clearTimeout(reset);
        pageAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: screenHeight, duration: 260, useNativeDriver: true }),
          Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setModalVisible(false));
      }
      return () => clearTimeout(reset);
    }
  }, [visible, animationsEnabled, slideAnim, backdropAnim, pageAnim]);

  const themeLabel = THEME_OPTIONS.find((o) => o.value === theme)?.label ?? '';

  return (
    <Modal visible={modalVisible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle}>
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

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
              {/* On-device only banner */}
              <View style={styles.onDeviceCard}>
                <View style={styles.onDeviceIcon}>
                  <Text style={{ fontSize: 20 }}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>On-device only</Text>
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
                  sub="Night-owl friendly — late logs count toward the previous day"
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
          </Animated.View>

          {/* ── Appearance sub-page ── */}
          <Animated.View style={[styles.page, { transform: [{ translateX: appearanceX }] }]}>
            <View style={styles.pageHeader}>
              <Pressable style={styles.iconBtn} onPress={goMain}>
                <Text style={styles.backBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.pageTitle}>Appearance</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
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
