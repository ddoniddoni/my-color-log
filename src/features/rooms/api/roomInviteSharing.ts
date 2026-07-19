import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import { getRoomInviteShareMessage } from '@/src/features/rooms/model/roomInviteLink';

type ShareRoomInviteInput = {
  inviteCode: string;
  roomName: string;
};

export async function shareRoomInvite({ inviteCode, roomName }: ShareRoomInviteInput): Promise<void> {
  const inviteLink = Linking.createURL('invite', { queryParams: { code: inviteCode } });
  const message = getRoomInviteShareMessage({ inviteCode, inviteLink, roomName });

  await Share.share({ message, title: `${roomName} 방 초대` });
}
