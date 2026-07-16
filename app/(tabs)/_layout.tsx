import { Tabs } from 'expo-router';

import { colors, spacing } from '@/src/design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: spacing[2],
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: '오늘', tabBarAccessibilityLabel: '오늘 탭' }} />
      <Tabs.Screen name="room" options={{ title: '친구방', tabBarAccessibilityLabel: '친구방 탭' }} />
      <Tabs.Screen name="diary" options={{ title: '다이어리', tabBarAccessibilityLabel: '다이어리 탭' }} />
    </Tabs>
  );
}
