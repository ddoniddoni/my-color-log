import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/src/components/feedback/AppErrorBoundary';
import { AppProviders } from '@/src/lib/providers/AppProviders';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppProviders>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AppProviders>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
