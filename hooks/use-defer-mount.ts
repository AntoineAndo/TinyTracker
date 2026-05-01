// Gates expensive children behind a post-navigation frame so screens paint
// instantly when entered. `InteractionManager.runAfterInteractions` resolves
// once React Native finishes the navigation/animation transition; an optional
// frame delay then staggers sibling widgets so each heavy mount lands on its
// own frame instead of one giant blocking frame.

import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Returns false on the first paint, then flips to true after the navigation
 * transition completes plus `delayFrames` rAF ticks. Use to short-circuit
 * heavy children with a skeleton until the transition is done.
 */
export function useDeferMount(delayFrames: number = 0): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      if (delayFrames <= 0) {
        setReady(true);
        return;
      }
      let remaining = delayFrames;
      const step = () => {
        if (cancelled) return;
        remaining -= 1;
        if (remaining <= 0) setReady(true);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [delayFrames]);

  return ready;
}
