import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useSettings } from '@/context/settings-context';
import { getCurrentDay, getLogicalDay } from '@/lib/utils';

/**
 * Returns the current logical day and a helper to convert any Date to its
 * logical calendar day, both respecting the user's configured day-start hour.
 *
 * Re-computes `today` whenever the app returns to the foreground so that a
 * session left open overnight always shows the correct day without a restart.
 */
export function useCurrentDay() {
  const { dayStartHour } = useSettings();
  const [today, setToday] = useState(() => getCurrentDay(dayStartHour));

  // Keep dayStartHour in a ref so the AppState handler always uses the latest
  // value without needing to be re-registered when settings change.
  const dayStartHourRef = useRef(dayStartHour);
  useEffect(() => { dayStartHourRef.current = dayStartHour; }, [dayStartHour]);

  // Recompute today when dayStartHour changes (e.g. user edits settings).
  useEffect(() => {
    setToday(getCurrentDay(dayStartHour));
  }, [dayStartHour]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setToday(getCurrentDay(dayStartHourRef.current));
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const toLogicalDay = useCallback(
    (date: Date) => getLogicalDay(date, dayStartHour),
    [dayStartHour],
  );
  return { today, toLogicalDay };
}
