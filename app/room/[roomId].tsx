import { Redirect, useLocalSearchParams } from 'expo-router';

import { RoomSetupCanvas } from '@/src/features/rooms/components/RoomSetupCanvas';

export default function RoomDetailRoute() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) return <Redirect href="/(tabs)/room" />;
  return <RoomSetupCanvas roomId={roomId} />;
}
