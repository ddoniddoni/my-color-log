import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

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
        tabBarButton: TabBarButton,
        tabBarItemStyle: { paddingTop: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1, marginTop: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: '오늘', tabBarAccessibilityLabel: '오늘 탭', tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.today} /> }} />
      <Tabs.Screen name="room" options={{ title: '친구방', tabBarAccessibilityLabel: '친구방 탭', tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.rooms} /> }} />
      <Tabs.Screen name="diary" options={{ title: '다이어리', tabBarAccessibilityLabel: '다이어리 탭', tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.diary} /> }} />
      <Tabs.Screen name="my" options={{ title: 'MY', tabBarAccessibilityLabel: '내 정보 탭', tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.my} /> }} />
    </Tabs>
  );
}

const tabIcons = {
  today: require('../../assets/images/tab-today.png'),
  rooms: require('../../assets/images/tab-rooms.png'),
  diary: require('../../assets/images/tab-diary.png'),
  my: require('../../assets/images/tab-my.png'),
} satisfies Record<string, number>;

function StitchTabIcon({ focused, source }: { focused: boolean; source: number }) {
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      contentFit="contain"
      importantForAccessibility="no"
      source={source}
      style={[styles.icon, !focused && styles.iconInactive]}
    />
  );
}

function TabBarButton({
  children,
  href: _href,
  onPress,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  ref: _ref,
  hoverEffect: _hoverEffect,
  style,
  ...props
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...props}
      android_ripple={{ color: 'transparent' }}
      onPress={(event) => onPress?.(event)}
      style={({ pressed }) => [style, pressed && styles.tabButtonPressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    height: 25,
    width: 25,
  },
  iconInactive: {
    opacity: 0.42,
  },
  tabButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
