import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

import { CharacterConfig, DEFAULT_CHARACTER, isValidCharacterConfig } from '@/components/character-avatar';

export type AnimationSetting = 'on' | 'system' | 'off';
export type ThemeSetting = 'light' | 'system' | 'dark';
interface SettingsContextValue {
  animations: AnimationSetting;
  setAnimations: (value: AnimationSetting) => void;
  theme: ThemeSetting;
  setTheme: (value: ThemeSetting) => void;
  /** Hour at which the logical day resets (0 = midnight, 3 = 3:00 AM, etc.) */
  dayStartHour: number;
  setDayStartHour: (value: number) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (value: boolean) => void;
  /** Hour of day (0–23) at which the daily reminder fires */
  reminderHour: number;
  setReminderHour: (value: number) => void;
  graphShowValues: boolean;
  setGraphShowValues: (value: boolean) => void;
  characterConfig: CharacterConfig;
  setCharacterConfig: (value: CharacterConfig) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  animations: 'system',
  setAnimations: () => {},
  theme: 'system',
  setTheme: () => {},
  dayStartHour: 3,
  setDayStartHour: () => {},
  reminderEnabled: false,
  setReminderEnabled: () => {},
  reminderHour: 20,
  setReminderHour: () => {},
  graphShowValues: true,
  setGraphShowValues: () => {},
  characterConfig: DEFAULT_CHARACTER,
  setCharacterConfig: () => {},
});

const ANIMATIONS_KEY = '@settings/animations';
const THEME_KEY = '@settings/theme';
const DAY_START_HOUR_KEY = '@settings/dayStartHour';
const REMINDER_ENABLED_KEY = '@settings/reminderEnabled';
const REMINDER_HOUR_KEY = '@settings/reminderHour';
const GRAPH_SHOW_VALUES_KEY = '@settings/graphShowValues';
const CHARACTER_KEY = '@settings/character';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [animations, setAnimationsState] = useState<AnimationSetting>('system');
  const [theme, setThemeState] = useState<ThemeSetting>('system');
  const [dayStartHour, setDayStartHourState] = useState<number>(3);
  const [reminderEnabled, setReminderEnabledState] = useState<boolean>(false);
  const [reminderHour, setReminderHourState] = useState<number>(20);
  const [graphShowValues, setGraphShowValuesState] = useState<boolean>(true);
  const [characterConfig, setCharacterConfigState] = useState<CharacterConfig>(DEFAULT_CHARACTER);

  useEffect(() => {
    AsyncStorage.getItem(ANIMATIONS_KEY).then((value) => {
      if (value === 'on' || value === 'system' || value === 'off') setAnimationsState(value);
    });
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === 'light' || value === 'system' || value === 'dark') setThemeState(value);
    });
    AsyncStorage.getItem(DAY_START_HOUR_KEY).then((value) => {
      const parsed = value !== null ? parseInt(value, 10) : NaN;
      if (!isNaN(parsed) && parsed >= -12 && parsed <= 11) setDayStartHourState(parsed);
    });
    AsyncStorage.getItem(REMINDER_ENABLED_KEY).then((value) => {
      if (value === 'true') setReminderEnabledState(true);
    });
    AsyncStorage.getItem(REMINDER_HOUR_KEY).then((value) => {
      const parsed = value !== null ? parseInt(value, 10) : NaN;
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) setReminderHourState(parsed);
    });
    AsyncStorage.getItem(GRAPH_SHOW_VALUES_KEY).then((value) => {
      if (value === 'false') setGraphShowValuesState(false);
    });
    AsyncStorage.getItem(CHARACTER_KEY).then((value) => {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (isValidCharacterConfig(parsed)) setCharacterConfigState(parsed);
        } catch {}
      }
    });
  }, []);

  function setAnimations(value: AnimationSetting) {
    setAnimationsState(value);
    AsyncStorage.setItem(ANIMATIONS_KEY, value);
  }

  function setTheme(value: ThemeSetting) {
    setThemeState(value);
    AsyncStorage.setItem(THEME_KEY, value);
  }

  function setDayStartHour(value: number) {
    setDayStartHourState(value);
    AsyncStorage.setItem(DAY_START_HOUR_KEY, String(value));
  }

  function setReminderEnabled(value: boolean) {
    setReminderEnabledState(value);
    AsyncStorage.setItem(REMINDER_ENABLED_KEY, String(value));
  }

  function setReminderHour(value: number) {
    setReminderHourState(value);
    AsyncStorage.setItem(REMINDER_HOUR_KEY, String(value));
  }

  function setGraphShowValues(value: boolean) {
    setGraphShowValuesState(value);
    AsyncStorage.setItem(GRAPH_SHOW_VALUES_KEY, String(value));
  }

  function setCharacterConfig(value: CharacterConfig) {
    setCharacterConfigState(value);
    AsyncStorage.setItem(CHARACTER_KEY, JSON.stringify(value));
  }

  return (
    <SettingsContext.Provider value={{
      animations, setAnimations,
      theme, setTheme,
      dayStartHour, setDayStartHour,
      reminderEnabled, setReminderEnabled,
      reminderHour, setReminderHour,
      graphShowValues, setGraphShowValues,
      characterConfig, setCharacterConfig,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
