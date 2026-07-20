import {
  parseRoomPhotoReactionSummaries,
  type RoomPhotoReactionEmoji,
  type RoomPhotoReactionSummary,
} from '@/src/features/reactions/model/roomPhotoReaction';
import { supabase } from '@/src/lib/supabase/client';

export async function getRoomPhotoReactions(roomId: string, photoId: string): Promise<RoomPhotoReactionSummary[]> {
  const { data, error } = await supabase.rpc('get_room_photo_reactions', {
    p_photo_id: photoId,
    p_room_id: roomId,
  });
  if (error) throw new Error('room_photo_reactions_fetch_failed');
  return parseRoomPhotoReactionSummaries(data);
}

export async function toggleRoomPhotoReaction(roomId: string, photoId: string, emoji: RoomPhotoReactionEmoji): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_room_photo_reaction', {
    p_emoji: emoji,
    p_photo_id: photoId,
    p_room_id: roomId,
  });
  if (error || typeof data !== 'boolean') throw new Error('room_photo_reaction_save_failed');
  return data;
}
