import { Redirect, useLocalSearchParams } from 'expo-router';

import { RoomSetupCanvas } from '@/src/features/rooms/components/RoomSetupCanvas';

export default function RoomDetailRoute() {
  const { photoId, roomId } = useLocalSearchParams<{ photoId?: string; roomId?: string }>();
  if (!roomId) return <Redirect href="/(tabs)/room" />;
  return <RoomSetupCanvas initialPhotoId={photoId} roomId={roomId} />;
}
