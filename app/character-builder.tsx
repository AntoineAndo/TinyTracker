import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CharacterAvatar,
  CharacterConfig,
  GLASSES_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
} from '@/components/character-avatar';
import { useSettings } from '@/context/settings-context';
import { AppTheme, useTheme } from '@/hooks/use-theme';

const HAIR_STYLE_OPTIONS: { value: CharacterConfig['hairStyle']; label: string }[] = [
  { value: 'bald', label: 'Bald' },
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
  { value: 'curly', label: 'Curly' },
];

const GLASSES_OPTIONS: { value: CharacterConfig['glasses']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'round', label: 'Round' },
  { value: 'rectangle', label: 'Rect' },
];

function makeStyles(c: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    preview: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      backgroundColor: c.card,
      marginHorizontal: 20,
      marginTop: 24,
      borderRadius: 18,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    section: { marginTop: 28, paddingHorizontal: 20, gap: 10 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSub,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    rowLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.segmentBg,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000',
      shadowOpacity: c.segmentActiveShadowOpacity,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textSub },
    segmentTextActive: { color: c.text },
    swatchRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
    swatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: c.tint,
    },
    swatchHitArea: { padding: 5 },
    bottomPad: { height: 40 },
  });
}

export default function CharacterBuilderScreen() {
  const { characterConfig, setCharacterConfig } = useSettings();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  function update<K extends keyof CharacterConfig>(key: K, value: CharacterConfig[K]) {
    setCharacterConfig({ ...characterConfig, [key]: value });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">

        {/* Preview */}
        <View style={styles.preview}>
          <CharacterAvatar config={characterConfig} size={200} />
        </View>

        {/* Face section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Face</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>Skin tone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
              {SKIN_TONES.map((hex) => (
                <Pressable
                  key={hex}
                  style={styles.swatchHitArea}
                  onPress={() => update('skinColor', hex)}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: hex },
                      characterConfig.skinColor === hex && styles.swatchSelected,
                    ]}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Hair section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hair</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>Style</Text>
            <View style={styles.segmentRow}>
              {HAIR_STYLE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, characterConfig.hairStyle === opt.value && styles.segmentActive]}
                  onPress={() => update('hairStyle', opt.value)}>
                  <Text style={[styles.segmentText, characterConfig.hairStyle === opt.value && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.rowLabel}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
              {HAIR_COLORS.map((hex) => (
                <Pressable
                  key={hex}
                  style={styles.swatchHitArea}
                  onPress={() => update('hairColor', hex)}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: hex },
                      characterConfig.hairColor === hex && styles.swatchSelected,
                    ]}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Glasses section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Glasses</Text>
          <View style={styles.card}>
            <View style={styles.segmentRow}>
              {GLASSES_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, characterConfig.glasses === opt.value && styles.segmentActive]}
                  onPress={() => update('glasses', opt.value)}>
                  <Text style={[styles.segmentText, characterConfig.glasses === opt.value && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {characterConfig.glasses !== 'none' && (
              <>
                <Text style={styles.rowLabel}>Color</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
                  {GLASSES_COLORS.map((hex) => (
                    <Pressable
                      key={hex}
                      style={styles.swatchHitArea}
                      onPress={() => update('glassesColor', hex)}>
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: hex },
                          characterConfig.glassesColor === hex && styles.swatchSelected,
                        ]}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}
