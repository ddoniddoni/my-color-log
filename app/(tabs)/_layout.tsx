import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { useReducedMotion } from '@/src/features/missions/hooks/useReducedMotion';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export default function TabLayout() {
  const reduceMotion = useReducedMotion();
  const theme = useAppTheme();
  const { t } = useAppLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.canvas,
          borderTopColor: theme.colors.borderStrong,
          borderTopWidth: 1,
          height: 84,
          overflow: 'hidden',
          paddingBottom: 18,
          paddingTop: spacing[2],
        },
        tabBarButton: (props) => <TabBarButton {...props} reduceMotion={reduceMotion} />,
        tabBarItemStyle: { paddingTop: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1, marginTop: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: t('오늘'), tabBarAccessibilityLabel: `${t('오늘')} ${t('탭')}`, tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.today} /> }} />
      <Tabs.Screen name="room" options={{ title: t('친구방'), tabBarAccessibilityLabel: `${t('친구방')} ${t('탭')}`, tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.rooms} /> }} />
      <Tabs.Screen name="diary" options={{ title: t('다이어리'), tabBarAccessibilityLabel: `${t('다이어리')} ${t('탭')}`, tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.diary} /> }} />
      <Tabs.Screen name="my" options={{ title: t('내 정보'), tabBarAccessibilityLabel: `${t('내 정보')} ${t('탭')}`, tabBarIcon: ({ focused }) => <StitchTabIcon focused={focused} source={tabIcons.my} /> }} />
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
  const theme = useAppTheme();
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      contentFit="contain"
      importantForAccessibility="no"
      source={source}
      style={[styles.icon, { tintColor: theme.colors.ink }, !focused && styles.iconInactive]}
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
  reduceMotion,
  style,
  ...props
}: BottomTabBarButtonProps & { reduceMotion: boolean }) {
  return (
    <Pressable
      {...props}
      android_ripple={{ color: 'transparent' }}
      onPress={(event) => onPress?.(event)}
      style={({ pressed }) => [style, pressed && (reduceMotion ? styles.tabButtonPressedReducedMotion : styles.tabButtonPressed)]}>
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
  tabButtonPressedReducedMotion: {
    opacity: 0.72,
  },
});
