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

/**
 * When `focusedTrackerId` is provided, the feed is filtered to insights that
 * involve that tracker (any pair containing it, plus its own trends) and the
 * top-K cap is dropped so every relevant pattern surfaces. With no focus, the
 * standard global top-K feed is returned.
 */
export function useInsights(focusedTrackerId?: string | null): InsightsResult {
  const { trackers, entriesByTrackerByDay } = useTrackers();
  const { today } = useCurrentDay();
  const { findings, ready, loading } = useCorrelations();

  const trends = useMemo(() => {
    if (!ready) return [];
    return findTrendInsights(trackers, entriesByTrackerByDay, { today });
  }, [ready, trackers, entriesByTrackerByDay, today]);

  const insights = useMemo(() => {
    if (focusedTrackerId) {
      const relevantFindings = findings.filter(
        (f) => f.trackerA.id === focusedTrackerId || f.trackerB.id === focusedTrackerId,
      );
      const relevantTrends = trends.filter((t) => t.tracker.id === focusedTrackerId);
      // Same top-K cap when focused — keep the feed scannable. The pre-filter
      // means these 5 are the strongest connections *for the tapped tracker*,
      // not the strongest 5 system-wide.
      return mergeInsights(relevantFindings, relevantTrends, TOP_K);
    }
    return mergeInsights(findings, trends, TOP_K);
  }, [findings, trends, focusedTrackerId]);

  return { insights, ready, loading };
}
