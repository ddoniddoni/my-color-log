import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/src/components/feedback/AppErrorBoundary';
import { GalleryImportRecovery } from '@/src/features/camera/components/GalleryImportRecovery';
import { AppProviders } from '@/src/lib/providers/AppProviders';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppProviders>
          <GalleryImportRecovery />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="camera" />
            <Stack.Screen name="photo-review" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="room/[roomId]" />
            <Stack.Screen name="room-history" />
          </Stack>
        </AppProviders>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
