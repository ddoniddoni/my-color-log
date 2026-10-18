import 'react-native-reanimated';

import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/src/components/feedback/AppErrorBoundary';
import { GalleryImportRecovery } from '@/src/features/camera/components/GalleryImportRecovery';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { useRoomPhotoNotificationNavigation } from '@/src/features/notifications/hooks/useRoomPhotoNotificationNavigation';
import { AppProviders } from '@/src/lib/providers/AppProviders';
import { useAppTheme } from '@/src/design/ThemeProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppProviders>
          <GalleryImportRecovery />
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="auth/forgot-password" />
            <Stack.Screen name="auth/reset-password" />
            <Stack.Screen name="camera" />
            <Stack.Screen name="photo-review" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="room/[roomId]" />
            <Stack.Screen name="room-history" />
          </Stack>
          <RoomPhotoNotificationNavigation />
        </AppProviders>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { resolvedTheme } = useAppTheme();
  return <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />;
}

function RoomPhotoNotificationNavigation() {
  const sessionState = useSessionBootstrap();
  const pathname = usePathname();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  useRoomPhotoNotificationNavigation(pathname.startsWith('/auth/') ? null : userId);
  return null;
}
