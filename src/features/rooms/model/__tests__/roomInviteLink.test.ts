import { getInviteCodeFromParam, getRoomInviteShareMessage } from '@/src/features/rooms/model/roomInviteLink';

describe('room invite links', () => {
  it('accepts one valid six digit query parameter only', () => {
    expect(getInviteCodeFromParam('012345')).toBe('012345');
    expect(getInviteCodeFromParam(['012345'])).toBeNull();
    expect(getInviteCodeFromParam('12345')).toBeNull();
    expect(getInviteCodeFromParam('abc123')).toBeNull();
  });

  it('creates a share message with both the link and a fallback code', () => {
    const message = getRoomInviteShareMessage({
      inviteCode: '012345',
      inviteLink: 'mycolorlog://invite?code=012345',
      roomName: '색수집단',
    });

    expect(message).toContain('색수집단');
    expect(message).toContain('012345');
    expect(message).toContain('mycolorlog://invite?code=012345');
  });

  it('does not create share text for an invalid code', () => {
    expect(() => getRoomInviteShareMessage({ inviteCode: '123', inviteLink: 'mycolorlog://invite?code=123', roomName: '색수집단' })).toThrow('room_invite_invalid');
  });
});
