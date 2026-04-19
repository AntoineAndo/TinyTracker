import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettings } from '@/context/settings-context';

export function useAnimationsEnabled(): boolean {
  const { animations } = useSettings();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    if (animations !== 'system') return;
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => sub.remove();
  }, [animations]);

  if (animations === 'on') return true;
  if (animations === 'off') return false;
  return !systemReduceMotion;
}
