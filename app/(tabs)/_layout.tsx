import { Tabs } from 'expo-router';
import React, { useState } from 'react';

import { CustomTabBar } from '@/components/custom-tab-bar';
import { SettingsDrawer } from '@/components/settings-drawer';

export default function TabLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Tabs
        initialRouteName="today"
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            onSettingsPress={() => setSettingsOpen(true)}
            settingsActive={settingsOpen}
          />
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="today" />
        <Tabs.Screen name="graph" />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
      <SettingsDrawer visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
