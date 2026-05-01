// Pulls older entry chunks until the in-memory window covers at least the
// requested day horizon, or until storage has nothing more to give. Owns the
// imperative loadMoreEntries() loop so feature hooks (e.g. useCorrelations)
// stay declarative. Cancellation-safe: the unmount guard prevents a stale
// loadMoreEntries response from setting state after the screen is gone.

import { useEffect, useMemo, useRef, useState } from 'react';

import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { toDateString } from '@/lib/utils';

export interface EnsureHorizonResult {
  /** True once the loop has terminated (target reached or hasMoreEntries === false). */
  ready: boolean;
  /** True while a chunk fetch is in flight. */
  loading: boolean;
  /** YYYY-MM-DD of the oldest currently-loaded entry; null when none. */
  oldestLoadedDay: string | null;
}

export function useEnsureHorizon(days: number): EnsureHorizonResult {
  const { isLoading, oldestLoadedDay, hasMoreEntries, loadMoreEntries } = useTrackers();
  const { today } = useCurrentDay();
  const [loading, setLoading] = useState(false);

  // Reset on every (re)mount so StrictMode's mount → unmount → remount cycle
  // does not leave the ref permanently `false` on the second mount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const targetOldest = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return toDateString(d);
  }, [today, days]);

  const horizonReached = oldestLoadedDay !== null && oldestLoadedDay <= targetOldest;
  const ready = !isLoading && !loading && (horizonReached || !hasMoreEntries);

  useEffect(() => {
    if (isLoading || loading) return;
    if (horizonReached || !hasMoreEntries) return;

    setLoading(true);
    loadMoreEntries().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [isLoading, loading, horizonReached, hasMoreEntries, loadMoreEntries]);

  return { ready, loading, oldestLoadedDay };
}
