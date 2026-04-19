import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/animated-button';
import { StreakBadge } from '@/components/streak-badge';
import { useTheme } from '@/hooks/use-theme';

export default function StreakTestScreen() {
  const [streak, setStreak] = useState(0);
  const c = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <AnimatedButton onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: c.text }]}>← Back</Text>
        </AnimatedButton>
        <Text style={[styles.title, { color: c.text }]}>Streak Test</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSub }]}>Current streak</Text>
          <View style={styles.badgeRow}>
            <StreakBadge streak={streak} fontSize={36} />
            {streak === 0 && <Text style={[styles.zero, { color: c.textSub }]}>—</Text>}
          </View>
        </View>

        <View style={styles.buttons}>
          <AnimatedButton
            style={[styles.btn, { backgroundColor: '#f97316' }]}
            onPress={() => setStreak((n) => n + 1)}>
            <Text style={styles.btnText}>+1</Text>
          </AnimatedButton>
          <AnimatedButton
            style={[styles.btn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}
            onPress={() => setStreak(0)}>
            <Text style={[styles.btnText, { color: c.text }]}>Reset</Text>
          </AnimatedButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 80 },
  backText: { fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, padding: 32 },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeRow: { justifyContent: 'center' },
  zero: { fontSize: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
