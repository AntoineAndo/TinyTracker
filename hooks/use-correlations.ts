// Top-level hook for the patterns/insights feature. Wires the trackers
// context (data + the lifted day-pivot), the routines context (for routine
// co-membership suppression), the current logical day, and the chunk-loading
// horizon into a single memoized list of pairwise findings ready for the
// InsightsSection UI.

import { useMemo } from 'react';

import { useRoutines } from '@/context/routines-context';
import { useTrackers } from '@/context/trackers-context';
import { useCurrentDay } from '@/hooks/use-current-day';
import { useEnsureHorizon } from '@/hooks/use-ensure-horizon';
import { Finding, findPairwiseInsights } from '@/lib/correlations';

const HORIZON_DAYS = 180;

export interface CorrelationsResult {
  findings: Finding[];
  /** True once the loader stopped (target reached or no more chunks). */
  ready: boolean;
  /** True while a chunk fetch is in flight. */
  loading: boolean;
}

export function useCorrelations(): CorrelationsResult {
  const { trackers, entriesByTrackerByDay } = useTrackers();
  const { routines } = useRoutines();
  const { today } = useCurrentDay();
  const horizon = useEnsureHorizon(HORIZON_DAYS);

  const routineMembership = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const r of routines) {
      for (const rt of r.trackers) {
        if (!map[rt.id]) map[rt.id] = new Set<string>();
        map[rt.id].add(r.id);
      }
    }
    return map;
  }, [routines]);

  const findings = useMemo(() => {
    if (!horizon.ready) return [];
    // Ask the engine for every finding that crosses the surfacing threshold,
    // not just the top 5. The constellation needs all of them so each tracker
    // gets a chance to connect. The Insights card slices to its own top-K
    // downstream via mergeInsights, so this doesn't flood the patterns list.
    return findPairwiseInsights(trackers, routineMembership, entriesByTrackerByDay, {
      today,
      horizonDays: HORIZON_DAYS,
      topK: Number.POSITIVE_INFINITY,
    });
  }, [horizon.ready, trackers, routineMembership, entriesByTrackerByDay, today]);

  return { findings, ready: horizon.ready, loading: horizon.loading };
}
