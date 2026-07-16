import { Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing } from '@/src/design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: '#F9F9F9',
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          height: 84,
          paddingBottom: 18,
          paddingTop: spacing[2],
        },
        tabBarItemStyle: { paddingTop: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1, marginTop: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: '오늘', tabBarAccessibilityLabel: '오늘 탭', tabBarIcon: ({ color, focused }) => <TodayTabIcon color={color} filled={focused} /> }} />
      <Tabs.Screen name="room" options={{ title: '친구방', tabBarAccessibilityLabel: '친구방 탭', tabBarIcon: ({ color }) => <RoomTabIcon color={color} /> }} />
      <Tabs.Screen name="diary" options={{ title: '다이어리', tabBarAccessibilityLabel: '다이어리 탭', tabBarIcon: ({ color }) => <DiaryTabIcon color={color} /> }} />
      <Tabs.Screen name="my" options={{ title: 'MY', tabBarAccessibilityLabel: '내 정보 탭', tabBarIcon: ({ color, focused }) => <MyTabIcon color={color} filled={focused} /> }} />
    </Tabs>
  );
}

function TodayTabIcon({ color, filled }: { color: ColorValue; filled: boolean }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M5.5 5.5h13v13h-13v-13Zm3.2-3v6m6.6-6v6M5.5 10h13" fill={filled ? color : 'none'} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function RoomTabIcon({ color }: { color: ColorValue }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M8.3 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.6-1.5a2.5 2.5 0 1 0 0-5m-12.1 14c.5-3.1 2.3-4.7 4.5-4.7s4 1.6 4.5 4.7m.5-3.5c1.8.3 3 1.4 3.4 3.5" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.6} /></Svg>;
}

function DiaryTabIcon({ color }: { color: ColorValue }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M5.5 4.5h10.4a2.6 2.6 0 0 1 2.6 2.6v12.4H8.1a2.6 2.6 0 0 1-2.6-2.6V4.5Zm3 3.7h6.8M8.5 12h6.8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function MyTabIcon({ color, filled }: { color: ColorValue; filled: boolean }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M12 11a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm-6 8.4c.7-3.2 2.8-4.9 6-4.9s5.3 1.7 6 4.9" fill={filled ? color : 'none'} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}
