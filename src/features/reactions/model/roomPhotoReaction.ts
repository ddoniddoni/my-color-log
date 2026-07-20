export const ROOM_PHOTO_REACTION_CHOICES = [
  { emoji: 'heart', label: '좋아요', symbol: '💛' },
  { emoji: 'sparkles', label: '반짝여요', symbol: '✨' },
  { emoji: 'wow', label: '멋져요', symbol: '👏' },
  { emoji: 'palette', label: '색이 좋아요', symbol: '🎨' },
] as const;

export type RoomPhotoReactionEmoji = (typeof ROOM_PHOTO_REACTION_CHOICES)[number]['emoji'];

export type RoomPhotoReactionSummary = {
  emoji: RoomPhotoReactionEmoji;
  count: number;
  reactedByMe: boolean;
};

export function isRoomPhotoReactionEmoji(value: unknown): value is RoomPhotoReactionEmoji {
  return typeof value === 'string' && ROOM_PHOTO_REACTION_CHOICES.some((choice) => choice.emoji === value);
}

export function parseRoomPhotoReactionSummaries(value: unknown): RoomPhotoReactionSummary[] {
  if (!Array.isArray(value)) throw new Error('invalid_room_photo_reactions_response');

  const byEmoji = new Map<RoomPhotoReactionEmoji, RoomPhotoReactionSummary>();
  for (const row of value) {
    const record = asRecord(row);
    const emoji = record.emoji;
    const count = record.reaction_count;
    const reactedByMe = record.reacted_by_me;
    if (!isRoomPhotoReactionEmoji(emoji)
      || typeof count !== 'number'
      || !Number.isInteger(count)
      || count < 0
      || typeof reactedByMe !== 'boolean'
      || byEmoji.has(emoji)) {
      throw new Error('invalid_room_photo_reactions_response');
    }
    byEmoji.set(emoji, { count, emoji, reactedByMe });
  }

  if (byEmoji.size !== ROOM_PHOTO_REACTION_CHOICES.length) throw new Error('invalid_room_photo_reactions_response');
  return ROOM_PHOTO_REACTION_CHOICES.map((choice) => {
    const reaction = byEmoji.get(choice.emoji);
    if (!reaction) throw new Error('invalid_room_photo_reactions_response');
    return reaction;
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('invalid_room_photo_reactions_response');
  return value as Record<string, unknown>;
}
