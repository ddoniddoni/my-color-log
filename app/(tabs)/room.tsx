import { useLocalSearchParams } from 'expo-router';

import { RoomListCanvas } from '@/src/features/rooms/components/RoomListCanvas';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';

export default function RoomScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string | string[] }>();

  return <RoomListCanvas initialInviteCode={getInviteCodeFromParam(inviteCode)} />;
}
