import { parseRoomPhotoReactionSummaries } from '@/src/features/reactions/model/roomPhotoReaction';

describe('room photo reaction summaries', () => {
  it('orders the server response by the fixed reaction chooser order', () => {
    expect(parseRoomPhotoReactionSummaries([
      { emoji: 'wow', reacted_by_me: false, reaction_count: 2 },
      { emoji: 'heart', reacted_by_me: true, reaction_count: 3 },
      { emoji: 'palette', reacted_by_me: false, reaction_count: 0 },
      { emoji: 'sparkles', reacted_by_me: false, reaction_count: 1 },
    ])).toEqual([
      { emoji: 'heart', reactedByMe: true, count: 3 },
      { emoji: 'sparkles', reactedByMe: false, count: 1 },
      { emoji: 'wow', reactedByMe: false, count: 2 },
      { emoji: 'palette', reactedByMe: false, count: 0 },
    ]);
  });

  it('rejects an incomplete server response', () => {
    expect(() => parseRoomPhotoReactionSummaries([
      { emoji: 'heart', reacted_by_me: false, reaction_count: 0 },
    ])).toThrow('invalid_room_photo_reactions_response');
  });
});
