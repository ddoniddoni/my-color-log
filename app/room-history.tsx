import { Redirect, useLocalSearchParams } from 'expo-router';

import { RoomHistoryCanvas } from '@/src/features/rooms/components/RoomHistoryCanvas';

export default function RoomHistoryRoute() {
  const { dateKey, photoId, roomId } = useLocalSearchParams<{ dateKey?: string; photoId?: string; roomId?: string }>();
  if (!roomId) return <Redirect href="/(tabs)/room" />;
  return <RoomHistoryCanvas initialDateKey={dateKey} initialPhotoId={photoId} roomId={roomId} />;
}
