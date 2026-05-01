// Top-level hook for the unified Patterns feed. Composes the pairwise
// correlation engine (`useCorrelations`) with the single-tracker trend engine
// (`findTrendInsights`) and merges them into one ranked list. Kept separate
// from `useCorrelations` so the constellation and overlay views can keep
// consuming pair findings directly without trends mixed in.

import { useMemo } from 'react';

import { useTrackers } from '@/context/trackers-context';
import { useCorrelations } from '@/hooks/use-correlations';
import { useCurrentDay } from '@/hooks/use-current-day';
import { Insight, mergeInsights } from '@/lib/insights';
import { findTrendInsights } from '@/lib/trends';

const TOP_K = 5;

export interface InsightsResult {
  insights: Insight[];
  ready: boolean;
  loading: boolean;
}

export function useInsights(): InsightsResult {
  const { trackers, entriesByTrackerByDay } = useTrackers();
  const { today } = useCurrentDay();
  const { findings, ready, loading } = useCorrelations();

  const trends = useMemo(() => {
    if (!ready) return [];
    return findTrendInsights(trackers, entriesByTrackerByDay, { today });
  }, [ready, trackers, entriesByTrackerByDay, today]);

  const insights = useMemo(
    () => mergeInsights(findings, trends, TOP_K),
    [findings, trends],
  );

  return { insights, ready, loading };
}
