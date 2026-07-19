import { Redirect, useLocalSearchParams } from 'expo-router';

import { RoomHistoryCanvas } from '@/src/features/rooms/components/RoomHistoryCanvas';

export default function RoomHistoryRoute() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) return <Redirect href="/(tabs)/room" />;
  return <RoomHistoryCanvas roomId={roomId} />;
}
