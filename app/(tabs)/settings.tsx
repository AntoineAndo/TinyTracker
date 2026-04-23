import { View } from 'react-native';

// Settings are shown via the SettingsDrawer — this route is kept so expo-router
// doesn't error on the file, but it's excluded from navigation via href: null
// in _layout.tsx.
export default function SettingsScreen() {
  return <View />;
}
