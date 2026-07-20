import { type ActiveRoom, type RoomMember } from '@/src/features/rooms/model/room';

export type RoomManagementState = {
  canEndRoom: boolean;
  canLeaveRoom: boolean;
  removableMembers: RoomMember[];
  successors: RoomMember[];
};

export function getRoomManagementState(room: ActiveRoom, currentUserId: string): RoomManagementState {
  const currentMember = room.members.find((member) => member.id === currentUserId);
  if (!currentMember) throw new Error('current_room_member_not_found');

  const isOwner = currentMember.role === 'owner';
  return {
    canEndRoom: isOwner,
    canLeaveRoom: !isOwner,
    removableMembers: isOwner ? room.members.filter((member) => member.id !== currentUserId) : [],
    successors: isOwner ? room.members.filter((member) => member.id !== currentUserId) : [],
  };
}
