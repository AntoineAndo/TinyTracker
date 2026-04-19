import { useColorScheme } from 'react-native';

import { useSettings } from '@/context/settings-context';

export function useAppColorScheme(): 'light' | 'dark' {
  const { theme } = useSettings();
  const systemScheme = useColorScheme() ?? 'light';
  if (theme === 'system') return systemScheme;
  return theme;
}
